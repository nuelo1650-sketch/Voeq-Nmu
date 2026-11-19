"use client";

// ---------------------------------------------------------------------------
// The application form — the first screen of Phase 1 (roadmap 1.1) and the
// home page. Four steps: Business → Owner → Photos → Review & consents.
//
// Image pipeline commitments baked in here (roadmap stages 1–3):
//   stage 1  photo or file pick — NO capture= attribute on the input (it
//            forced camera-only on many Android browsers and hid the gallery;
//            found at first real use 2026-11-19). The OS chooser offers the
//            camera AND the gallery, which is what "tap to take or choose"
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
import { compressImage, sha256Hex } from "@/lib/image-client";
import { TurnstileGate, turnstileClientEnforced } from "@/components/turnstile-widget";

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

export function ApplyForm() {
  // --- draft autosave (roadmap 1.3) ------------------------------------------
  // The form saves itself to THIS DEVICE as the applicant types — no account,
  // no tokens. A student on expensive data who loses the page loses nothing
  // but their photos (files cannot persist in a browser; the photo step shows
  // what to re-pick). The draft dies the moment submission succeeds.
  // Lazy initializers: the draft is IN the first render — no restore race.
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nmu-application-draft-v1") ?? "null") as {
        step?: number;
        businessName?: string;
        businessDescription?: string;
        website?: string;
        socialHandle?: string;
        voeqVendorUrl?: string;
        categoryId?: string;
        categoryOther?: string;
        campusId?: string;
        ownerName?: string;
        ownerPhone?: string;
        contactEmail?: string;
        consents?: Partial<Record<"declaration" | "terms" | "privacy" | "public_listing", boolean>>;
      } | null;
    } catch {
      return null;
    }
  });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const [step, setStep] = useState(() => Math.min(Math.max(1, draft?.step ?? 1), 4));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [businessName, setBusinessName] = useState(draft?.businessName ?? "");
  const [businessDescription, setBusinessDescription] = useState(draft?.businessDescription ?? "");
  const [website, setWebsite] = useState(draft?.website ?? "");
  const [socialHandle, setSocialHandle] = useState(draft?.socialHandle ?? "");
  const [voeqVendorUrl, setVoeqVendorUrl] = useState(draft?.voeqVendorUrl ?? "");
  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? "");
  // "Other" chosen: the applicant names their trade in their own words. The
  // register stores the generic "Other" category; the Media Unit adjusts it
  // later — this note is what they adjust FROM.
  const [categoryOther, setCategoryOther] = useState(draft?.categoryOther ?? "");
  const [campusId, setCampusId] = useState(draft?.campusId ?? "");
  const [ownerName, setOwnerName] = useState(draft?.ownerName ?? "");
  const [ownerPhone, setOwnerPhone] = useState(draft?.ownerPhone ?? "");
  const [contactEmail, setContactEmail] = useState(draft?.contactEmail ?? "");
  const [images, setImages] = useState<Record<FieldKey, FieldState>>({
    owner_photo: { status: "idle" },
    business_photo: { status: "idle" },
    cac_certificate: { status: "idle" },
  });
  const [consents, setConsents] = useState({
    declaration: draft?.consents?.declaration ?? false,
    terms: draft?.consents?.terms ?? false,
    privacy: draft?.consents?.privacy ?? false,
    public_listing: draft?.consents?.public_listing ?? false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Turnstile: empty until the invisible check issues a single-use token.
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
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

  // Autosave: debounced, best-effort, everything except the photos.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          "nmu-application-draft-v1",
          JSON.stringify({
            step,
            businessName,
            businessDescription,
            website,
            socialHandle,
            voeqVendorUrl,
            categoryId,
            categoryOther,
            campusId,
            ownerName,
            ownerPhone,
            contactEmail,
            consents,
            savedAt: new Date().toISOString(),
          }),
        );
        setDraftSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        // storage full or blocked: autosave is a safety net, never a requirement
      }
    }, 600);
    return () => clearTimeout(t);
  }, [step, businessName, businessDescription, website, socialHandle, voeqVendorUrl, categoryId, categoryOther, campusId, ownerName, ownerPhone, contactEmail, consents]);

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
  // The "Other" category needs the applicant's own words before it can move.
  const otherPicked = meta?.categories.find((c) => c.id === categoryId)?.slug === "other";
  const categoryOtherOk = !otherPicked || categoryOther.trim().length >= 2;
  const photosUploading = (["owner_photo", "business_photo", "cac_certificate"] as FieldKey[]).some(
    (f) => images[f].status === "compressing" || images[f].status === "uploading",
  );

  const canNext =
    (step === 1 && businessName.trim().length >= 2 && categoryId !== "" && categoryOtherOk && campusId !== "") ||
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
        voeqVendorUrl,
        campusId,
        categoryId,
        categoryOther: otherPicked ? categoryOther.trim() : undefined,
        ownerName,
        ownerPhone,
        contactEmail,
        images: (Object.values(images) as FieldState[])
          .filter((s) => s.descriptor)
          .map((s) => s.descriptor!),
        consents,
        turnstileToken: turnstileToken || undefined,
      };
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submit failed");
      try {
        localStorage.removeItem("nmu-application-draft-v1"); // the draft did its job
      } catch { /* best-effort */ }
      setReference(json.reference);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      // The old token was consumed by the failed attempt — get a fresh one.
      setTurnstileToken("");
      setTurnstileReset((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return <SuccessPanel reference={reference} businessName={businessName} />;
  }

  return (
    <section className="mt-10">
      {draft?.businessName && (
        <p className="mb-3 border-l-4 border-vq-forest bg-vq-forest/5 px-3 py-2 text-xs text-vq-forest-dark">
          Welcome back — your draft from this device is loaded where you left it.
          Photos are not saved in a browser; re-pick them on step 3.
        </p>
      )}
      {draftSavedAt && (
        <p className="mb-1 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
          Draft saved · {draftSavedAt}
        </p>
      )}
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
            {otherPicked && (
              <Field label="Tell us what it sells" hint="Your own words — the Media Unit will file it properly">
                <input
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value.slice(0, 80))}
                  placeholder="e.g. Phone flashing and software updates"
                  maxLength={80}
                  className={inputCls}
                />
              </Field>
            )}
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
            <Field label="Already selling on Voeq?" hint="Optional — your shop's link, if you have one">
              <input
                value={voeqVendorUrl}
                onChange={(e) => setVoeqVendorUrl(e.target.value.trim())}
                inputMode="url"
                placeholder="e.g. voeq.ng/shop/blessingstore"
                maxLength={200}
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
              title="A flyer of your business"
              hint="A poster, banner or flyer showing the business name"
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
              {otherPicked && <ReviewRow label="Category (your words)" value={categoryOther || "—"} />}
              <ReviewRow label="Campus" value={meta?.campuses.find((c) => c.id === campusId)?.name ?? "—"} />
              <ReviewRow label="Owner" value={ownerName} />
              <ReviewRow label="Phone" value={ownerPhone} />
              <ReviewRow label="Email" value={contactEmail} />
              <ReviewRow label="Website" value={website || "Not provided"} />
              <ReviewRow label="Social" value={socialHandle || "Not provided"} />
              <ReviewRow label="Voeq shop" value={voeqVendorUrl || "Not provided"} />
              <ReviewRow
                label="Describe"
                value={businessDescription || "Not provided"}
              />
              <ReviewRow
                label="Photos"
                value={`${ownerPhotoDone ? "You ✓" : ""}${ownerPhotoDone && businessPhotoDone ? " · " : ""}${businessPhotoDone ? "Flyer ✓" : ""}${images.cac_certificate.status === "done" ? " · CAC ✓" : ""}`}
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
                I accept the{" "}
                <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-vq-forest underline underline-offset-2">
                  privacy notice (v1)
                </a>{" "}
                — my details are used to run this register, nothing else.
              </Consent>
              <Consent
                checked={consents.public_listing}
                onChange={(v) => setConsents((c) => ({ ...c, public_listing: v }))}
              >
                If approved, I understand my business name, category, campus and business flyer will be publicly listed in the directory.
              </Consent>
            </div>

            {turnstileClientEnforced && (
              <TurnstileGate onToken={setTurnstileToken} resetSignal={turnstileReset} />
            )}

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
            disabled={!allConsents || submitting || (turnstileClientEnforced && !turnstileToken)}
            className="flex-1 bg-vq-forest px-5 py-3.5 text-sm font-semibold text-white shadow-md transition enabled:hover:bg-vq-forest-mid disabled:opacity-40 sm:flex-none sm:px-8"
          >
            {submitting
              ? "Submitting…"
              : turnstileClientEnforced && !turnstileToken
                ? "Security check…"
                : "Submit application"}
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
      <div className="mx-auto mt-6 max-w-sm border-t border-vq-forest/15 pt-5 text-sm leading-relaxed text-vq-ink-muted">
        <p>
          Want to watch it move?{" "}
          <a href="/track" className="font-semibold text-vq-forest underline">
            Track your application
          </a>{" "}
          — your reference and this email address are all it takes.
        </p>
        <p className="mt-3">
          <b>P.S.</b> — Do you also want to{" "}
          <a
            href="https://voeq.ng/for-vendors"
            className="font-semibold text-vq-forest underline"
          >
            sell on Voeq
          </a>
          ? The campus marketplace thousands of students already use. Getting
          started takes minutes.
        </p>
      </div>
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
  // The <label> WRAPS the control: implicit association, no id bookkeeping,
  // and every input in the form is announced correctly by a screen reader.
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-semibold text-vq-forest-dark">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-vq-ink-subtle">{hint}</span>}
    </label>
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
