"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { grantAdminByEmail, setMemberRole, setUserBanned } from "@/app/actions/admin";
import { cx, formatDate, fullName, monogram } from "@/lib/format";
import { Avatar, Button, Card, Tag } from "@/components/ui/primitives";
import type { AdminMember, AppLocale, UserRole } from "@/types/database";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendeur" },
  { value: "admin", label: "Admin" },
];

const FIELD =
  "w-full rounded-[14px] border border-[var(--color-outline)] bg-white/60 px-3 py-[10px] text-[12.5px] font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] placeholder:font-normal placeholder:text-[var(--color-faint)]";

/* ─── Nommer un administrateur ──────────────────────────────────────────── */

export function AddAdminForm({ adminCount }: { adminCount: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await grantAdminByEmail(email);

      if (result.ok) {
        setEmail("");
        setFeedback({ kind: "ok", message: "Administrateur nommé." });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-[10px] p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-[10px] text-start"
      >
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[13px] font-bold text-[var(--color-brand)]">
          +
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-bold text-[var(--color-ink)]">
            Ajouter un administrateur
          </span>
          <span className="block text-[10.5px] text-[var(--color-muted)]">
            {adminCount} administrateur{adminCount > 1 ? "s" : ""} · partagez la gestion de la
            plateforme
          </span>
        </span>
        <span aria-hidden className="flex-none text-[11px] text-[var(--color-faint)]">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            autoComplete="off"
            placeholder="collegue@exemple.com"
            className={FIELD}
          />

          <Button type="submit" size="sm" disabled={pending || !email.includes("@")}>
            {pending ? "…" : "Nommer administrateur"}
          </Button>

          <p className="text-[9.5px] leading-[1.45] text-[var(--color-muted)]">
            La personne doit déjà avoir un compte sur l&apos;application. Elle retrouvera l&apos;espace
            d&apos;administration à sa prochaine connexion.
          </p>

          {feedback && (
            <p
              role="status"
              className={cx(
                "text-[11px] font-semibold",
                feedback.kind === "ok" ? "text-[var(--color-brand)]" : "text-[var(--color-live)]",
              )}
            >
              {feedback.message}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}

/* ─── Recherche ─────────────────────────────────────────────────────────── */

export function MemberSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");

    const query = next.toString();
    router.push(query ? `/admin/membres?${query}` : "/admin/membres");
  }

  return (
    <form onSubmit={onSubmit} className="flex-none">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type="search"
        placeholder="Nom ou adresse e-mail…"
        aria-label="Rechercher un membre"
        className={FIELD}
      />
    </form>
  );
}

/* ─── Fiche membre ──────────────────────────────────────────────────────── */

export function MemberCard({
  member,
  isMe,
  locale,
}: {
  member: AdminMember;
  isMe: boolean;
  locale: AppLocale;
}) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(member.role);
  const [banned, setBanned] = useState(member.is_banned);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onRole(next: UserRole) {
    if (next === role) return;

    const previous = role;
    setRole(next);
    setError(null);

    startTransition(async () => {
      const result = await setMemberRole(member.id, next);
      if (result.ok) router.refresh();
      else {
        setRole(previous);
        setError(result.error);
      }
    });
  }

  function onBan() {
    const next = !banned;
    setBanned(next);
    setError(null);

    startTransition(async () => {
      const result = await setUserBanned(member.id, next);
      if (result.ok) router.refresh();
      else {
        setBanned(!next);
        setError(result.error);
      }
    });
  }

  return (
    <Card className="flex flex-none flex-col gap-[10px] p-[11px]">
      <div className="flex items-center gap-[10px]">
        <Avatar
          src={member.avatar_url}
          initials={monogram(member.first_name, member.last_name)}
          size={34}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-bold text-[var(--color-ink)]">
            {fullName(member) || "—"}
            {isMe && <span className="ms-1 font-semibold text-[var(--color-muted)]">(vous)</span>}
          </p>
          <p className="truncate text-[10px] text-[var(--color-muted)]">{member.email}</p>
        </div>

        {banned && <Tag tone="live">Suspendu</Tag>}
      </div>

      <p className="text-[9.5px] text-[var(--color-muted)]">
        {member.city ?? "Gafsa"} · {member.loyalty_points} pts · inscrit le{" "}
        {formatDate(member.created_at, locale)}
        {member.last_sign_in_at
          ? ` · vu le ${formatDate(member.last_sign_in_at, locale)}`
          : " · jamais connecté"}
        {member.shop_name && ` · ${member.shop_name} (${member.shop_status})`}
      </p>

      <div className="flex items-center gap-[6px]">
        <div
          role="group"
          aria-label="Rôle"
          className="flex flex-1 gap-[4px] rounded-[14px] bg-[var(--color-brand-tint)] p-[3px]"
        >
          {ROLES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={pending}
              aria-pressed={role === option.value}
              onClick={() => onRole(option.value)}
              className={cx(
                "min-h-[28px] flex-1 rounded-[11px] text-[10px] font-bold transition-colors disabled:opacity-60",
                role === option.value
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-brand)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {!isMe && (
          <button
            type="button"
            disabled={pending}
            onClick={onBan}
            className={cx(
              "min-h-[28px] flex-none rounded-[12px] px-[9px] text-[10px] font-bold disabled:opacity-50",
              banned
                ? "border border-[var(--color-outline)] text-[var(--color-muted)]"
                : "bg-[var(--color-live)] text-white",
            )}
          >
            {banned ? "Réactiver" : "Suspendre"}
          </button>
        )}
      </div>

      {error && (
        <p role="status" className="text-[10.5px] font-semibold text-[var(--color-live)]">
          {error}
        </p>
      )}
    </Card>
  );
}
