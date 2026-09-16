"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";

export interface ApplicationActionsProps {
  applicationId: string;
  status: ApplicationStatus;
  screeningStatus: string | null;
  /** Teams in this trial's age band — the only valid destinations. */
  teams: ReadonlyArray<{ id: string; name: string }>;
  canDecide: boolean;
  /** Only an unscoped caller may hand an evaluation to a coach. */
  canAssignEvaluation: boolean;
  evaluators: ReadonlyArray<{ id: string; name: string }>;
  templates: ReadonlyArray<{ id: string; title: string }>;
  playerId: string;
  /** How many submitted evaluations this applicant already has. */
  evaluationCount: number;
}

async function send(
  url: string,
  method: "PUT" | "POST",
  body: unknown,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;

    const payload: unknown = await response.json();
    return typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message ===
        "string"
      ? (payload as { error: { message: string } }).error.message
      : "درخواست انجام نشد.";
  } catch {
    return "ارتباط با سرور برقرار نشد.";
  }
}

/**
 * Screening and the decision, on one application.
 *
 * Two separate steps on purpose: passing the paperwork is not being accepted,
 * and a coach who ticks "documents complete" has not chosen anyone. The
 * decision controls stay hidden until screening has approved, so the order
 * the club works in is the order the interface allows
 * (docs/BUSINESS_RULES.md §15).
 */
export function ApplicationActions({
  applicationId,
  status,
  screeningStatus,
  teams,
  canDecide,
  canAssignEvaluation,
  evaluators,
  templates,
  playerId,
  evaluationCount,
}: ApplicationActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [teamId, setTeamId] = React.useState(teams[0]?.id ?? "");
  const [evaluatorId, setEvaluatorId] = React.useState(evaluators[0]?.id ?? "");

  const decided = ["ACCEPTED", "REJECTED", "CANCELLED"].includes(status);
  const screened = screeningStatus === "APPROVED";

  async function run(
    label: string,
    url: string,
    method: "PUT" | "POST",
    body: unknown,
  ): Promise<void> {
    setBusy(true);
    const error = await send(url, method, body);
    setBusy(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(label);
    setNote("");
    router.refresh();
  }

  if (decided) {
    return (
      <p className="text-xs text-muted-foreground">تصمیم نهایی ثبت شده است.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor={`note-${applicationId}`} className="text-xs">
          یادداشت
        </Label>
        <Input
          id={`note-${applicationId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="برای رد کردن الزامی است"
          className="h-7 text-xs"
        />
      </div>

      {!screened ? (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="xs"
            disabled={busy}
            onClick={() =>
              void run(
                "غربالگری تأیید شد",
                `/api/v1/applications/${applicationId}/screening`,
                "PUT",
                {
                  status: "APPROVED",
                  ageEligible: true,
                  documentsComplete: true,
                  ...(note ? { note } : {}),
                },
              )
            }
          >
            تأیید غربالگری
          </Button>
          <Button
            type="button"
            size="xs"
            variant="destructive"
            disabled={busy || !note}
            onClick={() =>
              void run(
                "درخواست در غربالگری رد شد",
                `/api/v1/applications/${applicationId}/screening`,
                "PUT",
                { status: "REJECTED", note },
              )
            }
          >
            رد در غربالگری
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/*
            Handing the evaluation to a coach is how a coach reaches a trial
            player at all — they hold no tryout permission
            (docs/BUSINESS_RULES.md §16).
          */}
          {canAssignEvaluation &&
          evaluators.length > 0 &&
          templates.length > 0 ? (
            <div className="space-y-1.5 border-b border-border pb-2">
              <Label htmlFor={`evaluator-${applicationId}`} className="text-xs">
                سپردن ارزیابی به مربی
                {evaluationCount > 0
                  ? ` (${evaluationCount} ارزیابی ثبت‌شده)`
                  : ""}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Select value={evaluatorId} onValueChange={setEvaluatorId}>
                  <SelectTrigger
                    id={`evaluator-${applicationId}`}
                    className="h-7 flex-1"
                  >
                    <SelectValue placeholder="انتخاب مربی" />
                  </SelectTrigger>
                  <SelectContent>
                    {evaluators.map((evaluator) => (
                      <SelectItem key={evaluator.id} value={evaluator.id}>
                        {evaluator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  disabled={busy || !evaluatorId}
                  onClick={() =>
                    void run(
                      "ارزیابی به مربی سپرده شد",
                      "/api/v1/evaluations",
                      "POST",
                      {
                        playerId,
                        templateId: templates[0]!.id,
                        evaluatorId,
                        applicationId,
                      },
                    )
                  }
                >
                  سپردن
                </Button>
              </div>
            </div>
          ) : null}

          {canDecide ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`team-${applicationId}`} className="text-xs">
                  تیم مقصد
                </Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger id={`team-${applicationId}`} className="h-7">
                    <SelectValue placeholder="انتخاب تیم" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  disabled={busy || !teamId}
                  onClick={() =>
                    void run(
                      "بازیکن پذیرفته شد",
                      `/api/v1/applications/${applicationId}/decision`,
                      "POST",
                      {
                        decision: "ACCEPTED",
                        teamId,
                        ...(note ? { note } : {}),
                      },
                    )
                  }
                >
                  پذیرش
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      "به فهرست انتظار رفت",
                      `/api/v1/applications/${applicationId}/decision`,
                      "POST",
                      { decision: "WAITLIST", ...(note ? { note } : {}) },
                    )
                  }
                >
                  فهرست انتظار
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      "درخواست رد شد",
                      `/api/v1/applications/${applicationId}/decision`,
                      "POST",
                      { decision: "REJECTED", ...(note ? { note } : {}) },
                    )
                  }
                >
                  رد درخواست
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              غربالگری تأیید شده است؛ تصمیم نهایی با مدیر آکادمی است.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
