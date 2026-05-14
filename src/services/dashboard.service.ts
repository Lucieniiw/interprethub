import { JobStatus, UserRole } from "#prisma-client";
import { prisma } from "../lib/prisma.js";
import * as activityService from "./activity.service.js";

/** Shown on the admin dashboard; full history is on the Activity page. */
export const DASHBOARD_RECENT_ACTIVITY_LIMIT = 5;

export async function getJobCountsByStatus() {
  const [open, assigned, completed] = await Promise.all([
    prisma.job.count({ where: { status: JobStatus.OPEN } }),
    prisma.job.count({ where: { status: JobStatus.ASSIGNED } }),
    prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
  ]);
  return { open, assigned, completed };
}

export type DashboardOverview = {
  assignments: { total: number };
  jobs: {
    open: number;
    assigned: number;
    completed: number;
    cancelled: number;
    paid: number;
  };
  declines: { logged: number };
  linguists: { active: number };
  clients: { activeWithJobs: number };
  topClients: Array<{ clientId: number; name: string; jobCount: number }>;
  topLinguists: Array<{ interpreterId: number; name: string; assignmentCount: number }>;
  recentActivity: Array<{
    id: number;
    type: string;
    message: string;
    createdAt: string;
    userName: string | null;
  }>;
};

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [
    totalJobs,
    open,
    assigned,
    completed,
    cancelled,
    paid,
    declinesLogged,
    activeLinguists,
    activeClientsCount,
    topClientGroups,
    topInterpGroups,
    recentRows,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: JobStatus.OPEN } }),
    prisma.job.count({ where: { status: JobStatus.ASSIGNED } }),
    prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
    prisma.job.count({ where: { status: JobStatus.CANCELLED } }),
    prisma.job.count({ where: { status: JobStatus.PAID } }),
    prisma.jobDecline.count(),
    prisma.user.count({
      where: { role: UserRole.INTERPRETER, interpreterStatus: "ACTIVE" },
    }),
    prisma.client.count({ where: { jobs: { some: {} } } }),
    prisma.job.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.job.groupBy({
      by: ["interpreterId"],
      where: { interpreterId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    activityService.listActivityForStaff(DASHBOARD_RECENT_ACTIVITY_LIMIT),
  ]);

  const clientIds = topClientGroups.map((g) => g.clientId).filter((id): id is number => id != null);
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const topClients = topClientGroups.map((g) => {
    const cid = g.clientId as number;
    return {
      clientId: cid,
      name: clientMap.get(cid) ?? `Client #${cid}`,
      jobCount: g._count.id,
    };
  });

  const interpIds = topInterpGroups.map((g) => g.interpreterId).filter((id): id is number => id != null);
  const interpUsers =
    interpIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: interpIds } },
          select: { id: true, name: true },
        })
      : [];
  const interpMap = new Map(interpUsers.map((u) => [u.id, u.name]));

  const topLinguists = topInterpGroups.map((g) => {
    const iid = g.interpreterId as number;
    return {
      interpreterId: iid,
      name: interpMap.get(iid) ?? `User #${iid}`,
      assignmentCount: g._count.id,
    };
  });

  const recentActivity = recentRows.map((a) => ({
    id: a.id,
    type: a.type,
    message: a.message,
    createdAt: a.createdAt.toISOString(),
    userName: a.user?.name ?? null,
  }));

  return {
    assignments: { total: totalJobs },
    jobs: { open, assigned, completed, cancelled, paid },
    declines: { logged: declinesLogged },
    linguists: { active: activeLinguists },
    clients: { activeWithJobs: activeClientsCount },
    topClients,
    topLinguists,
    recentActivity,
  };
}
