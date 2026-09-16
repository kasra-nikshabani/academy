"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatJalali } from "@/lib/utils/date";
import {
  APPLICATION_STATUS_CLASS,
  APPLICATION_STATUS_LABEL,
  SCREENING_STATUS_LABEL,
} from "./tryout-meta";
import type {
  ApplicationStatus,
  ScreeningStatus,
} from "@/lib/generated/prisma/enums";

interface LookupResult {
  trackingCode: string;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  screening: { status: ScreeningStatus; note: string | null } | null;
  tryout: {
    title: string;
    slug: string;
    heldAt: string | null;
    venue: string | null;
    city: string | null;
  };
  player: { person: { firstName: string; lastName: string } };
}

/**
 * Following an application without an account.
 *
 * Both the tracking code **and** the number are required, and a wrong pair
 * gives the same answer as a code that does not exist — so this page cannot
 * be used to find out whether a code is real (docs/SECURITY.md).
 *
 * Posted rather than sent as a query string, so neither value lands in
 * browser history or a server log.
 */
export function ApplicationStatusLookup() {
  const [trackingCode, setTrackingCode] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LookupResult | null>(null);

  async function lookup(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/v1/tryouts/public/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingCode, mobile }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: { message?: unknown } }).error
            ?.message === "string"
            ? (payload as { error: { message: string } }).error.message
            : "درخواست انجام نشد.";
        setError(message);
        return;
      }

      setResult((payload as { data: LookupResult }).data);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={lookup}
        className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trackingCode">کد پیگیری</Label>
            <Input
              id="trackingCode"
              required
              dir="ltr"
              className="font-mono"
              placeholder="SEP-T-XXXXXXXX"
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lookup-mobile">شماره موبایل</Label>
            <Input
              id="lookup-mobile"
              required
              inputMode="numeric"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={busy}>
          {busy ? "در حال بررسی…" : "مشاهده وضعیت"}
        </Button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{result.tryout.title}</h2>
            <Badge className={cn(APPLICATION_STATUS_CLASS[result.status])}>
              {APPLICATION_STATUS_LABEL[result.status]}
            </Badge>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div>
              <dt className="inline text-muted-foreground">بازیکن: </dt>
              <dd className="inline">
                {result.player.person.firstName} {result.player.person.lastName}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">تاریخ ثبت: </dt>
              <dd className="inline">
                {formatJalali(new Date(result.submittedAt))}
              </dd>
            </div>
            {result.screening ? (
              <div>
                <dt className="inline text-muted-foreground">غربالگری: </dt>
                <dd className="inline">
                  {SCREENING_STATUS_LABEL[result.screening.status]}
                  {result.screening.note ? ` — ${result.screening.note}` : ""}
                </dd>
              </div>
            ) : null}
            {result.tryout.heldAt ? (
              <div>
                <dt className="inline text-muted-foreground">زمان برگزاری: </dt>
                <dd className="inline">
                  {formatJalali(new Date(result.tryout.heldAt))}
                  {result.tryout.venue ? ` — ${result.tryout.venue}` : ""}
                </dd>
              </div>
            ) : null}
            {result.decisionNote ? (
              <div>
                <dt className="inline text-muted-foreground">توضیح: </dt>
                <dd className="inline">{result.decisionNote}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
