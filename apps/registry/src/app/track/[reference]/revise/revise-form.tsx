"use client";

// The resubmission form. Pre-filled with everything the applicant wrote;
// each existing photo defaults to KEPT (same asset carried onto the new
// revision) and can be replaced through the same compress → upload pipeline
// as the original form. Flagged fields are not auto-focused (the applicant
// may need to touch several) but the flag list sits directly above.

import { useCallback, useState } from "react";

interface PhotoKept {
  field: "owner_photo" | "business_photo" | "cac_certificate";
  publicId: string;
  url: string;
  sizeBytes: number;
}

export interface ReviseInitial {
  token: string;
  reference: string;
  businessName: string;
  businessDescription: string;
  website: string;
  socialHandle: string;
  ownerName: string;
  ownerPhone: string;
  contactEmail: string;
  campusId: string;
  categoryId: string;
  categoryOther?: string;
  photos: PhotoKept[];
}

type FieldKey = PhotoKept["field"];

interface PhotoState {
  mode: "kept" | "replaced" | "busy" | "error";
  publicId?: string;
  previewUrl?: string;
  descriptor?: {
    publicId: string;
    originalName: string;
    mimeType: "image/jpeg" | "image/png";
    sizeBytes: number;
    width: number;
    height: number;
    checksumSha256: string;
  };
  error?: string;
}

const PHOTO_LABELS: Record<FieldKey, { title: string; hint: string }> = {
  owner_photo: { title: "A photo of you", hint: "Clear face, daylight" },
  business_photo: { title: "A flyer of your business", hint: "A poster, banner or flyer showing the business name" },
  cac_certificate: { title: "CAC certificate", hint: "Only if the business has one" },
};

const inputCls =
  "w-full border border-vq-forest/20 bg-white px-4 py-3 text-[15px] text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none";

export function ReviseForm({ initial }: { initial: ReviseInitial }) {
  const [form, setForm] = useState({
    businessName: initial.businessName,
    businessDescription: initial.businessDescription,
    website: initial.website,
    socialHandle: initial.socialHandle,
    ownerName: initial.ownerName,
    ownerPhone: initial.ownerPhone,
    contactEmail: initial.contactEmail,
    campusId: initial.campusId,
    categoryId: initial.categoryId,
    categoryOther: initial.categoryOther ?? "",
  });
  const [photos, setPhotos] = useState<Record<FieldKey, PhotoState>>(() => {
    const base = {} as Record<FieldKey, PhotoState>;
    (Object.keys(PHOTO_LABELS) as FieldKey[]).forEach((f) => {
      const kept = initial.photos.find((p) => p.field === f);
      base[f] = kept
        ? { mode: "kept", publicId: kept.publicId }
        : { mode: "error", error: "No photo on file — please upload one" };
    });
    return base;
  });
  const [declaration, setDeclaration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [meta, setMeta] = useState<{ campuses: { id: string; name: string }[]; categories: { id: string; name: string; slug: string }[] } | null>(null);

  if (!meta) {
    fetch("/api/form-meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta({ campuses: [], categories: [] }));
  }

  const pick = useCallback(async (field: FieldKey, file: File) => {
    setPhotos((prev) => ({ ...prev, [field]: { mode: "busy" } }));
    try {
      const { compressImage, sha256Hex } = await import("@/lib/image-client");
      const { blob, width, height } = await compressImage(file);
      const fd = new FormData();
      const jpg = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      fd.append("file", jpg);
      fd.append("width", String(width));
      fd.append("height", String(height));
      const res = await fetch("/api/apply/image", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const checksum = await sha256Hex(await blob.arrayBuffer());
      setPhotos((prev) => ({
        ...prev,
        [field]: {
          mode: "replaced",
          previewUrl: URL.createObjectURL(blob),
          descriptor: {
            publicId: json.publicId,
            originalName: file.name.slice(0, 120),
            mimeType: json.mimeType,
            sizeBytes: json.sizeBytes,
            width: json.width ?? width,
            height: json.height ?? height,
            checksumSha256: checksum,
          },
        },
      }));
    } catch (err) {
      setPhotos((prev) => ({
        ...prev,
        [field]: { mode: "error", error: err instanceof Error ? err.message : "Something went wrong" },
      }));
    }
  }, []);

  const photosReady = (["owner_photo", "business_photo"] as FieldKey[]).every(
    (f) => photos[f].mode === "kept" || photos[f].mode === "replaced",
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const images = (Object.keys(PHOTO_LABELS) as FieldKey[])
        .filter((f) => photos[f].mode === "kept" || photos[f].mode === "replaced")
        .map((f) => {
          const p = photos[f];
          if (p.mode === "kept") return { field: f, keep: true, publicId: p.publicId! };
          return { field: f, keep: false, ...p.descriptor! };
        });
      const res = await fetch("/api/track/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: initial.token,
          payload: { ...form, images, declaration: declaration },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submit failed");
      setDone(json.revisionNo as number);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 border border-vq-forest/20 bg-white/85 p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-forest">Resubmitted</p>
        <h2 className="mt-3 font-display text-2xl text-vq-forest-dark">
          Back with the Media Unit.
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-vq-ink-muted">
          <b>{initial.reference}</b> — revision {done} — is resubmitted under the
          same reference. Nothing was lost; the log shows this resubmission as
          part of the same story. The Media Unit re-reads it the day it arrives.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="border border-vq-forest/10 bg-white/80 p-5 shadow-sm">
        <h2 className="font-display text-xl text-vq-forest-dark">The business</h2>
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Business name</label>
        <input value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} className={inputCls} />
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">What it sells</label>
        <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className={inputCls}>
          <option value="" disabled>Choose a category…</option>
          {meta?.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {meta?.categories.find((c) => c.id === form.categoryId)?.slug === "other" && (
          <>
            <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Tell us what it sells</label>
            <input
              value={form.categoryOther ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, categoryOther: e.target.value.slice(0, 80) }))}
              placeholder="Your own words — the Media Unit will file it properly"
              maxLength={80}
              className={inputCls}
            />
          </>
        )}
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Campus</label>
        <select value={form.campusId} onChange={(e) => setForm((f) => ({ ...f, campusId: e.target.value }))} className={inputCls}>
          {meta?.campuses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Describe it</label>
        <textarea
          value={form.businessDescription}
          onChange={(e) => setForm((f) => ({ ...f, businessDescription: e.target.value.slice(0, 600) }))}
          rows={3}
          className={`${inputCls} resize-none`}
        />
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Website</label>
        <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value.trim() }))} className={inputCls} />
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Social media</label>
        <input value={form.socialHandle} onChange={(e) => setForm((f) => ({ ...f, socialHandle: e.target.value.trim() }))} className={inputCls} />
      </div>

      <div className="border border-vq-forest/10 bg-white/80 p-5 shadow-sm">
        <h2 className="font-display text-xl text-vq-forest-dark">The owner</h2>
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Your full name</label>
        <input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} className={inputCls} />
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Phone number</label>
        <input value={form.ownerPhone} onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value.trim() }))} inputMode="tel" className={inputCls} />
        <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">Email address</label>
        <input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value.trim() }))} type="email" inputMode="email" className={inputCls} />
      </div>

      <div className="border border-vq-forest/10 bg-white/80 p-5 shadow-sm">
        <h2 className="font-display text-xl text-vq-forest-dark">The photos</h2>
        <p className="mt-2 text-xs leading-relaxed text-vq-ink-subtle">
          A photo you keep stays exactly as it was. Replace one only if the
          flagged items ask for it.
        </p>
        {(Object.keys(PHOTO_LABELS) as FieldKey[]).map((f) => (
          <div key={f} className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="text-sm font-semibold text-vq-forest-dark">{PHOTO_LABELS[f].title}</label>
              <span className="text-xs text-vq-ink-subtle">{PHOTO_LABELS[f].hint}</span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/heic,image/webp"
              className="hidden"
              id={`revise-file-${f}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(f, file);
                e.target.value = "";
              }}
            />
            <div
              className={`border-2 px-4 py-4 transition ${
                photos[f].mode === "kept" || photos[f].mode === "replaced"
                  ? "border-vq-forest/40 bg-vq-forest/5"
                  : photos[f].mode === "error"
                    ? "border-red-300 bg-red-50"
                    : "border-dashed border-vq-forest/25 bg-white/60"
              }`}
            >
              {photos[f].mode === "kept" && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={initial.photos.find((p) => p.field === f)?.url}
                    alt={PHOTO_LABELS[f].title}
                    className="h-16 w-16 object-cover"
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-vq-forest">Kept — unchanged</p>
                    <p className="text-xs text-vq-ink-subtle">
                      {(initial.photos.find((p) => p.field === f)?.sizeBytes ?? 0) / 1024 >= 0
                        ? `${(((initial.photos.find((p) => p.field === f)?.sizeBytes ?? 0) / 1024) || 0).toFixed(0)}KB · carried onto the new revision`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById(`revise-file-${f}`)?.click()}
                    className="border border-vq-forest/25 bg-white px-3 py-2 text-xs font-semibold text-vq-forest transition hover:bg-white"
                  >
                    Replace
                  </button>
                </div>
              )}
              {photos[f].mode === "replaced" && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos[f].previewUrl} alt={PHOTO_LABELS[f].title} className="h-16 w-16 object-cover" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-vq-forest">Replaced ✓</p>
                    <p className="text-xs text-vq-ink-subtle">
                      {((photos[f].descriptor!.sizeBytes / 1024) || 0).toFixed(0)}KB · new upload
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById(`revise-file-${f}`)?.click()}
                    className="border border-vq-forest/25 bg-white px-3 py-2 text-xs font-semibold text-vq-forest transition hover:bg-white"
                  >
                    Again
                  </button>
                </div>
              )}
              {photos[f].mode === "busy" && <p className="text-sm text-vq-ink-muted">Compressing and uploading…</p>}
              {photos[f].mode === "error" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-red-700">{photos[f].error}</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById(`revise-file-${f}`)?.click()}
                    className="border border-vq-forest/25 bg-white px-3 py-2 text-xs font-semibold text-vq-forest transition hover:bg-white"
                  >
                    Upload
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <label className="flex cursor-pointer items-start gap-3 border border-vq-forest/10 bg-white/60 p-4 text-sm leading-relaxed text-vq-ink transition hover:border-vq-forest/30">
        <input
          type="checkbox"
          checked={declaration}
          onChange={(e) => setDeclaration(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F2A1D]"
        />
        <span>
          I confirm that this updated application is true, and that the business
          is genuinely mine.
        </span>
      </label>

      {error && (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={!photosReady || !declaration || busy || !form.businessName.trim() || !form.ownerName.trim()}
        className="w-full bg-vq-forest px-5 py-3.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Resubmitting…" : "Resubmit — same reference"}
      </button>
      <p className="text-center text-xs text-vq-ink-subtle">
        The Media Unit re-reads it the day it arrives — no queue-jumping, no penalty.
      </p>
    </div>
  );
}
