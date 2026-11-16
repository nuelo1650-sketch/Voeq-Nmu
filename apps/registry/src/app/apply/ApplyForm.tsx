"use client";

// ---------------------------------------------------------------------------
// The application form — the first screen of Phase 1 (roadmap 1.1) and the
// home page. Four steps: Business → Owner → Photos → Review & consents.
//
// Image pipeline commitments baked in here (roadmap stages 1–3):
//   stage 1  camera-first capture ("capture=environment") with gallery fallback
//   stage 2  compression on the phone BEFORE any byte leaves: canvas
//            re-encode, longest edge ≤1600px, quality stepped down from 0.85
//            until ≤200KB, EXIF orientation applied then stripped (no GPS
//            metadata ever uploaded)
//   stage 3  upload goes to OUR API route, never directly to the CDN
//
// The server re-validates everything (apply-schema + magic bytes); this
// client's checks exist to save the applicant's data, not to be trusted.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_BYTES = 200 * 1024;
const HARD_BYTES = 300 * 1024;
const LONGEST_EDGE = 1600;

type FieldKey = "owner_photo" | "business_photo" | "cac_certificate";

interface ImageDescriptor {
  field: FieldKey;
  publicId: string;
  originalName: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
  width: number;
  height: number;
  checksumSha256: string;
}

interface FieldState {
  status: "idle" | "compressing" | "uploading" | "done" | "error";
  error?: string;
  descriptor?: ImageDescriptor;
  previewUrl?: string;
}

interface Meta {
  campuses: { id: string; name: string; slug: string; isDefault: boolean }[];
  categories: { id: string; name: string; slug: string }[];
}

const STEPS = ["Business", "Owner", "Photos", "Review"] as const;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stage 2 — compress on the phone. Canvas re-encode = EXIF stripped. */
async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let w = bitmap.width;
  let h = bitmap.height;
  const long = Math.max(w, h);
  if (long > LONGEST_EDGE) {
    const s = LONGEST_EDGE / long;
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  let quality = 0.85;
  let cw = w;
  let ch = h;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable on this browser");
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Re-encode failed"))), "image/jpeg", quality),
    );
    if (blob.size <= TARGET_BYTES) break;
    if (quality > 0.5) {
      quality -= 0.15;
    } else {
      cw = Math.round(cw * 0.8);
      ch = Math.round(ch * 0.8);
      if (cw < 200 || ch < 200) break;
    }
  }
  if (!blob || blob.size > HARD_BYTES) {
    throw new Error("This photo resists compression — try another one");
  }
  return { blob, width: cw, height: ch };
}

export function ApplyForm() {
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [images, setImages] = useState<Record<FieldKey, FieldState>>({
    owner_photo: { status: "idle" },
    business_photo: { status: "idle" },
    cac_certificate: { status: "idle" },
  });
  const [consents, setConsents] = useState({ declaration: false, terms: false, privacy: false, public_listing: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/form-meta")
      .then((r) => r.json())
      .then((m: Meta) => {
        setMeta(m);
        const def = m.campuses.find((c) => c.isDefault) ?? m.campuses[0];
        if (def) setCampusId((prev) => prev || def.id);
      })
      .catch(() => setMeta({ campuses: [], categories: [] }));
  }, []);

  const handleFile = useCallback(async (field: FieldKey, file: File) => {
    setImages((prev) => ({ ...prev, [field]: { status: "compressing" } }));
    try {
      const { blob, width, height } = await compressImage(file);
      setImages((prev) => ({ ...prev, [field]: { status: "uploading" } }));
      const form = new FormData();
      const jpg = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      form.append("file", jpg);
      form.append("width", String(width));
      form.append("height", String(height));
      const res = await fetch("/api/apply/image", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const previewUrl = URL.createObjectURL(blob);
      const descriptor: ImageDescriptor = {
        field,
        publicId: json.publicId,
        originalName: file.name.slice(0, 120),
        mimeType: json.mimeType,
        sizeBytes: json.sizeBytes,
        width: json.width ?? width,
        height: json.height ?? height,
        checksumSha256: await sha256Hex(await blob.arrayBuffer()),
      };
      setImages((prev) => ({ ...prev, [field]: { status: "done", descriptor, previewUrl } }));
    } catch (err) {
      setImages((prev) => ({
        ...prev,
        [field]: { status: "error", error: err instanceof Error ? err.message : "Something went wrong" },
      }));
    }
  }, []);

  const ownerPhotoDone = images.owner_photo.status === "done";
  const businessPhotoDone = images.business_photo.status === "done";
  const photosUploading = (["owner_photo", "business_photo", "cac_certificate"] as FieldKey[]).some(
    (f) => images[f].status === "compressing" || images[f].status === "uploading",
  );

  const canNext =
    (step === 1 && businessName.trim().length >= 2 && categoryId !== "" && campusId !== "") ||
    (step === 2 && ownerName.trim().length >= 3 && ownerPhone.trim().length >= 10 && contactEmail.includes("@")) ||
    (step === 3 && ownerPhotoDone && businessPhotoDone && !photosUploading) ||
    step === 4;

  const allConsents = Object.values(consents).every(Boolean);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        businessName,
        businessDescription,
        website,
        socialHandle,
        campusId,
        categoryId,
        ownerName,
        ownerPhone,
        contactEmail,
        images: (Object.values(images) as FieldState[])
          .filter((s) => s.descriptor)
          .map((s) => s.descriptor!),
        consents,
      };
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submit failed");
      setReference(json.reference);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return <SuccessPanel reference={reference} businessName={businessName} />;
  }

  return (
    <section className="mt-10">
      {/* step indicator */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n === step ? "current" : n < step ? "done" : "todo";
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs font-bold ${
                  state === "current"
                    ? "bg-vq-forest text-white"
                    : state === "done"
                      ? "bg-vq-forest/15 text-vq-forest"
                      : "border border-vq-forest/25 text-vq-ink-subtle"
                }`}
              >
                {n < step ? "✓" : n}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:block ${
                  state === "todo" ? "text-vq-ink-subtle" : "text-vq-forest-dark"
                }`}
              >
                {label}
              </span>
              {n < STEPS.length && <span className="h-px flex-1 bg-vq-forest/15" />}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 rounded-2xl border border-vq-forest/10 bg-white/80 p-5 shadow-sm sm:p-6">
        {step === 1 && (
          <>
            <StepTitle>The business</StepTitle>
            <Field label="Business name" hint="As it is written on your signboard">
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Blessing Provision Store"
                maxLength={120}
                className={inputCls}
              />
            </Field>
            <Field label="What it sells" hint="Choose the closest — the Media Unit can adjust later">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="" disabled>
                  Choose a category…
                </option>
                {meta?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Campus">
              <select value={campusId} onChange={(e) => setCampusId(e.target.value)} className={inputCls}>
                {meta?.campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isDefault ? " (main)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Describe it in a line or two" hint="Optional — shown on your public entry when approved">
              <textarea
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value.slice(0, 600))}
                rows={3}
                placeholder="What you sell, where exactly, when you are open…"
                className={`${inputCls} resize-none`}
              />
              <p className="mt-1 text-right text-[11px] text-vq-ink-subtle">{businessDescription.length}/600</p>
            </Field>
            <Field label="Website" hint="Optional — if the business has one">
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value.trim())}
                inputMode="url"
                placeholder="e.g. blessingstore.voeq.ng"
                maxLength={200}
                className={inputCls}
              />
            </Field>
            <Field label="Social media" hint="Optional — Instagram, WhatsApp Business, X…">
              <input
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value.trim())}
                placeholder="e.g. @blessingstore"
                maxLength={80}
                className={inputCls}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle>The owner</StepTitle>
            <Field label="Your full name">
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Blessing Oyibo"
                maxLength={120}
                className={inputCls}
              />
            </Field>
            <Field label="Phone number" hint="For the Media Unit to reach you about this application">
              <input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value.trim())}
                inputMode="tel"
                placeholder="0801 234 5678"
                className={inputCls}
              />
            </Field>
            <Field label="Email address" hint="Every update about this application goes here">
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value.trim())}
                inputMode="email"
                type="email"
                placeholder="you@example.com"
                className={inputCls}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle>Three photos</StepTitle>
            <p className="mb-4 text-sm leading-relaxed text-vq-ink-muted">
              Taken on your phone is fine. Each photo is compressed on your
              phone to under 200KB before upload — gentle on your data.
            </p>
            <PhotoField
              fieldKey="owner_photo"
              state={images.owner_photo}
              title="A photo of you"
              hint="Clear face, daylight"
              required
              onPick={handleFile}
              setInputRef={(el) => (fileInputs.current.owner_photo = el)}
              openPicker={() => fileInputs.current.owner_photo?.click()}
            />
            <PhotoField
              fieldKey="business_photo"
              state={images.business_photo}
              title="Your shop or stand"
              hint="Front view — the signboard helps"
              required
              onPick={handleFile}
              setInputRef={(el) => (fileInputs.current.business_photo = el)}
              openPicker={() => fileInputs.current.business_photo?.click()}
            />
            <PhotoField
              fieldKey="cac_certificate"
              state={images.cac_certificate}
              title="CAC certificate"
              hint="Only if the business has one"
              onPick={handleFile}
              setInputRef={(el) => (fileInputs.current.cac_certificate = el)}
              openPicker={() => fileInputs.current.cac_certificate?.click()}
            />
          </>
        )}

        {step === 4 && (
          <>
            <StepTitle>Review and agree</StepTitle>
            <dl className="divide-y divide-vq-forest/10 rounded-xl border border-vq-forest/10 bg-white/60">
              <ReviewRow label="Business" value={businessName} />
              <ReviewRow label="Category" value={meta?.categories.find((c) => c.id === categoryId)?.name ?? "—"} />
              <ReviewRow label="Campus" value={meta?.campuses.find((c) => c.id === campusId)?.name ?? "—"} />
              <ReviewRow label="Owner" value={ownerName} />
              <ReviewRow label="Phone" value={ownerPhone} />
              <ReviewRow label="Email" value={contactEmail} />
              <ReviewRow label="Website" value={website || "Not provided"} />
              <ReviewRow label="Social" value={socialHandle || "Not provided"} />
              <ReviewRow
                label="Describe"
                value={businessDescription || "Not provided"}
              />
              <ReviewRow
                label="Photos"
                value={`${ownerPhotoDone ? "You ✓" : ""}${ownerPhotoDone && businessPhotoDone ? " · " : ""}${businessPhotoDone ? "Shop ✓" : ""}${images.cac_certificate.status === "done" ? " · CAC ✓" : ""}`}
              />
            </dl>

            <div className="mt-5 space-y-3">
              <Consent
                checked={consents.declaration}
                onChange={(v) => setConsents((c) => ({ ...c, declaration: v }))}
              >
                I declare that the information given in this application is true, and that the business is genuinely mine.
              </Consent>
              <Consent checked={consents.terms} onChange={(v) => setConsents((c) => ({ ...c, terms: v }))}>
                I accept the terms of the NMU business register (v1).
              </Consent>
              <Consent checked={consents.privacy} onChange={(v) => setConsents((c) => ({ ...c, privacy: v }))}>
                I accept the privacy notice (v1) — my details are used to run this register, nothing else.
              </Consent>
              <Consent
                checked={consents.public_listing}
                onChange={(v) => setConsents((c) => ({ ...c, public_listing: v }))}
              >
                If approved, I understand my business name, category, campus and shop photo will be publicly listed in the directory.
              </Consent>
            </div>

            {submitError && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {submitError}
              </p>
            )}
          </>
        )}
      </div>

      {/* nav */}
      <div className="mt-5 flex items-center gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="border border-vq-forest/25 bg-white/60 px-5 py-3 text-sm font-semibold text-vq-forest transition hover:bg-white"
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex-1 bg-vq-forest px-5 py-3.5 text-sm font-semibold text-white shadow-md transition enabled:hover:bg-vq-forest-mid disabled:opacity-40 sm:flex-none sm:px-8"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!allConsents || submitting}
            className="flex-1 bg-vq-forest px-5 py-3.5 text-sm font-semibold text-white shadow-md transition enabled:hover:bg-vq-forest-mid disabled:opacity-40 sm:flex-none sm:px-8"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
      {step === 4 && !allConsents && (
        <p className="mt-2 text-xs text-vq-ink-subtle">Tick all four to submit — they are the record&apos;s honesty.</p>
      )}
    </section>
  );
}

// --- success -----------------------------------------------------------------

function SuccessPanel({ reference, businessName }: { reference: string; businessName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="mt-10 rounded-2xl border border-vq-forest/10 bg-white/80 p-6 text-center shadow-sm sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">Received</p>
      <h2 className="mt-3 font-display text-2xl text-vq-forest-dark">We have your application.</h2>
      <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
        <b>{businessName}</b> is in. A person at the Media Unit reads it within
        five working days, and emails you the moment there is a decision.
      </p>
      <div className="mx-auto mt-6 max-w-xs rounded-xl border-2 border-dashed border-vq-amber/60 bg-vq-cream px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-vq-ink-subtle">Your reference — keep it</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-vq-forest">{reference}</p>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(reference).then(() => setCopied(true));
        }}
        className="mt-3 border border-vq-forest/25 bg-white/60 px-4 py-2 text-xs font-semibold text-vq-forest transition hover:bg-white"
      >
        {copied ? "Copied ✓" : "Copy reference"}
      </button>
      <ol className="mx-auto mt-7 max-w-sm space-y-2 text-left text-sm leading-relaxed text-vq-ink-muted">
        <li>1 · A person reads your application — top to bottom.</li>
        <li>2 · If something needs fixing, they email you exactly what.</li>
        <li>3 · Nothing is charged until your entry is approved.</li>
      </ol>
    </section>
  );
}

// --- small pieces -------------------------------------------------------------

const inputCls =
  "w-full rounded-xl border border-vq-forest/20 bg-white px-4 py-3 text-[15px] text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none";

function StepTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-xl text-vq-forest-dark">{children}</h2>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold text-vq-forest-dark">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-vq-ink-subtle">{hint}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">{label}</dt>
      <dd className="text-right text-sm font-medium text-vq-ink">{value}</dd>
    </div>
  );
}

function Consent({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-vq-forest/10 bg-white/60 p-3.5 text-sm leading-relaxed text-vq-ink transition hover:border-vq-forest/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F2A1D]"
      />
      <span>{children}</span>
    </label>
  );
}

function PhotoField({
  fieldKey,
  state,
  title,
  hint,
  required,
  onPick,
  setInputRef,
  openPicker,
}: {
  fieldKey: FieldKey;
  state: FieldState;
  title: string;
  hint: string;
  required?: boolean;
  onPick: (field: FieldKey, file: File) => void;
  setInputRef: (el: HTMLInputElement | null) => void;
  openPicker: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-sm font-semibold text-vq-forest-dark">
          {title}
          {required && <span className="ml-1 text-vq-amber-dark">*</span>}
        </label>
        <span className="text-xs text-vq-ink-subtle">{hint}</span>
      </div>
      <input
        ref={setInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(fieldKey, f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={openPicker}
        className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left transition ${
          state.status === "done"
            ? "border-vq-forest/40 bg-vq-forest/5"
            : state.status === "error"
              ? "border-red-300 bg-red-50"
              : "border-vq-forest/25 bg-white/60 hover:border-vq-forest/50"
        }`}
      >
        {state.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.previewUrl} alt={title} className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-vq-forest/10 text-2xl text-vq-forest">
            +
          </span>
        )}
        <span className="flex-1">
          {state.status === "done" && (
            <>
              <span className="block text-sm font-semibold text-vq-forest">Added ✓</span>
              <span className="block text-xs text-vq-ink-subtle">
                {(state.descriptor!.sizeBytes / 1024).toFixed(0)}KB · tap to replace
              </span>
            </>
          )}
          {state.status === "compressing" && <span className="text-sm text-vq-ink-muted">Compressing on your phone…</span>}
          {state.status === "uploading" && <span className="text-sm text-vq-ink-muted">Uploading…</span>}
          {state.status === "idle" && <span className="text-sm text-vq-ink-muted">Tap to take or choose a photo</span>}
          {state.status === "error" && <span className="text-sm text-red-700">{state.error}</span>}
        </span>
      </button>
    </div>
  );
}
