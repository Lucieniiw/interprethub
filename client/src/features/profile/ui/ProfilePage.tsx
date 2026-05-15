import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import { useAuth } from "@/features/auth/model/auth-context";
import { resolveUploadUrl } from "@/utils/resolve-upload-url";
import styles from "./ProfilePage.module.css";

type Profile = {
  id: number;
  name: string;
  email: string;
  role: string;
  languages: string[];
  phone: string | null;
  profilePhoto: string | null;
  address: string | null;
  emergencyContact: string | null;
  interpreterProfile: {
    rateInPerson: number;
    rateVirtual: number;
    ratePhone: number;
    rateMileage: number;
    rateTravelTime: number;
  } | null;
};

function formatHourUsd(n: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " per hour"
  );
}

function formatMileUsd(n: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " per mile"
  );
}

function resolvePayRates(profile: Profile | null): {
  rateInPerson: number;
  rateVirtual: number;
  ratePhone: number;
  rateMileage: number;
  rateTravelTime: number;
} {
  const p = profile?.interpreterProfile;
  if (!p) {
    return { rateInPerson: 0, rateVirtual: 0, ratePhone: 0, rateMileage: 0, rateTravelTime: 0 };
  }
  return {
    rateInPerson: p.rateInPerson,
    rateVirtual: p.rateVirtual,
    ratePhone: p.ratePhone,
    rateMileage: p.rateMileage,
    rateTravelTime: p.rateTravelTime,
  };
}

export function ProfilePage({
  embedded = false,
  embeddedTitle = "Account & profile",
}: {
  embedded?: boolean;
  embeddedTitle?: string;
}) {
  const { user, refreshUser } = useAuth();
  const isInterp = user?.role === "INTERPRETER";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [photoPreviewBroken, setPhotoPreviewBroken] = useState(false);
  const [address, setAddress] = useState("");
  const [emergency, setEmergency] = useState("");
  const [langs, setLangs] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Profile>("/profile")
      .then((r) => {
        const p = r.data;
        setProfile(p);
        setName(p.name);
        setPhone(p.phone ?? "");
        setPhotoPreviewBroken(false);
        setAddress(p.address ?? "");
        setEmergency(p.emergencyContact ?? "");
        setLangs(p.languages.join(", "));
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  useEffect(() => {
    setPhotoPreviewBroken(false);
  }, [pendingPreviewUrl, profile?.profilePhoto]);

  function onPickPhoto(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setPendingFile(f);
    setPhotoPreviewBroken(false);
  }

  async function uploadPendingPhoto() {
    if (!pendingFile) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", pendingFile);
      const { data } = await api.post<Profile>("/profile/photo", fd);
      setProfile(data);
      setPendingPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPendingFile(null);
      await refreshUser();
    } catch {
      setError("Photo upload failed.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function removePhoto() {
    if (pendingFile || pendingPreviewUrl) {
      setPendingPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPendingFile(null);
      setPhotoPreviewBroken(false);
      return;
    }
    if (!profile?.profilePhoto?.trim()) return;

    setPhotoUploading(true);
    setError(null);
    try {
      const { data } = await api.delete<Profile>("/profile/photo");
      setProfile(data);
      await refreshUser();
    } catch {
      setError("Could not remove photo.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const languages = langs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const base = {
        name,
        phone: phone || null,
        languages,
      };

      const payload = isInterp
        ? {
            ...base,
            address: address || null,
            emergencyContact: emergency || null,
          }
        : base;

      await api.patch("/profile", payload);
      const { data } = await api.get<Profile>("/profile");
      setProfile(data);
      await refreshUser();
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function initials(nm: string): string {
    const parts = nm.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nm.slice(0, 2).toUpperCase() || "?";
  }

  if (loading) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  const savedPhotoSrc = resolveUploadUrl(profile?.profilePhoto);
  const previewSrc = pendingPreviewUrl ?? savedPhotoSrc;
  const hasSavedPhoto = Boolean(profile?.profilePhoto?.trim());
  const pay = resolvePayRates(profile);

  return (
    <div className={embedded ? styles.embeddedRoot : styles.page}>
      {!embedded ? (
        <header className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.lead}>{profile?.email}</p>
        </header>
      ) : (
        <h2 className={styles.embeddedHeading}>{embeddedTitle}</h2>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.card}>
        <h2 className={styles.h2}>Profile photo</h2>
        <div className={styles.photoRow}>
          <div className={styles.photoPreview} aria-hidden>
            {previewSrc && !photoPreviewBroken ? (
              <img
                src={previewSrc}
                alt=""
                className={styles.photoPreviewImg}
                onError={() => setPhotoPreviewBroken(true)}
              />
            ) : (
              <span className={styles.photoPreviewFallback}>{initials(name)}</span>
            )}
          </div>
          <div className={styles.photoFields}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className={styles.fileHidden}
              onChange={onPickPhoto}
            />
            <div className={styles.photoActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
              >
                Choose photo…
              </button>
              <button
                type="button"
                className={styles.primaryMini}
                onClick={() => void uploadPendingPhoto()}
                disabled={!pendingFile || photoUploading}
              >
                {photoUploading ? "Working…" : "Upload"}
              </button>
              {(hasSavedPhoto || pendingFile) && (
                <button type="button" className={styles.dangerMini} onClick={() => void removePhoto()} disabled={photoUploading}>
                  {pendingFile ? "Clear selection" : "Remove photo"}
                </button>
              )}
            </div>
            <p className={styles.photoHint}>
              JPEG, PNG, GIF, or WebP — max 2 MB. Upload replaces your current photo in the header.
            </p>
          </div>
        </div>
      </div>

      <form className={styles.card} onSubmit={onProfileSubmit}>
        <h2 className={styles.h2}>Contact</h2>
        <div className={styles.grid}>
          <label className={styles.label}>
            Name
            <input className={styles.input} value={name} onChange={(ev) => setName(ev.target.value)} required />
          </label>
          <label className={styles.label}>
            Phone
            <input className={styles.input} value={phone} onChange={(ev) => setPhone(ev.target.value)} />
          </label>
          {isInterp ? (
            <>
              <label className={`${styles.label} ${styles.full}`}>
                Address
                <input className={styles.input} value={address} onChange={(ev) => setAddress(ev.target.value)} />
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Emergency contact
                <input className={styles.input} value={emergency} onChange={(ev) => setEmergency(ev.target.value)} />
              </label>
            </>
          ) : null}
          <label className={`${styles.label} ${styles.full}`}>
            Languages (comma-separated)
            <input className={styles.input} value={langs} onChange={(ev) => setLangs(ev.target.value)} />
          </label>
        </div>
        <button className={styles.submit} type="submit" disabled={saving}>
          Save profile
        </button>
      </form>

      {isInterp ? (
        <section className={styles.card} aria-label="Default pay rates">
          <h2 className={styles.h2}>Default pay rates</h2>
          <p className={styles.ratesLead}>Hourly interpretation is USD/hr; mileage is USD/mile; travel time is USD/hr.</p>
          <p className={styles.ratesManagedHint}>
            These amounts are set by your coordinator team in User Management. Contact them if you need a change.
          </p>
          {!profile?.interpreterProfile ? (
            <p className={styles.profileMissing}>
              No pay profile saved yet — amounts show as $0.00 until an administrator sets them.
            </p>
          ) : null}
          <dl className={styles.ratesGrid}>
            <dt>In-person</dt>
            <dd>{formatHourUsd(pay.rateInPerson)}</dd>
            <dt>Virtual</dt>
            <dd>{formatHourUsd(pay.rateVirtual)}</dd>
            <dt>Phone</dt>
            <dd>{formatHourUsd(pay.ratePhone)}</dd>
            <dt>Mileage</dt>
            <dd>{formatMileUsd(pay.rateMileage)}</dd>
            <dt>Travel time</dt>
            <dd>{formatHourUsd(pay.rateTravelTime)}</dd>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
