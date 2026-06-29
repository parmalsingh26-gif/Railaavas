import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import crypto from "crypto";

const app = express();
const PORT = 3000;
const prisma = new PrismaClient();

app.use(express.json({ limit: '10mb' }));

// ============================================================
// CASCADING SLA MATRIX (Hardcoded, Deterministic, No AI)
// ============================================================
const SLA_MATRIX: Record<string, Record<string, { priority: string; hours: number }>> = {
  'Civil': {
    'Pipe Leak':        { priority: 'Critical', hours: 12 },
    'Roof Seepage':     { priority: 'High',     hours: 48 },
    'Broken Door':      { priority: 'Medium',   hours: 168 },
    'Wall Crack':       { priority: 'Medium',   hours: 168 },
    'Floor Damage':     { priority: 'Low',      hours: 336 },
    'Ceiling Damage':   { priority: 'High',     hours: 72  },
    'Plaster Falling':  { priority: 'High',     hours: 48  },
    'Compound Wall':    { priority: 'Low',      hours: 504 },
  },
  'Electrical': {
    'Total Power Failure': { priority: 'Critical', hours: 6  },
    'Wiring Fault':        { priority: 'High',     hours: 24 },
    'Fan Not Working':     { priority: 'Medium',   hours: 72 },
    'Socket Dead':         { priority: 'Medium',   hours: 72 },
    'Meter Issue':         { priority: 'High',     hours: 48 },
    'MCB Tripping':        { priority: 'High',     hours: 24 },
    'Tube Light Fused':    { priority: 'Low',      hours: 96 },
    'AC/Cooler Issue':     { priority: 'Medium',   hours: 72 },
  },
  'Sanitary': {
    'Drain Blocked':         { priority: 'Critical', hours: 12 },
    'Sewage Overflow':       { priority: 'Critical', hours: 6  },
    'Tap Broken':            { priority: 'High',     hours: 24 },
    'Flush Not Working':     { priority: 'High',     hours: 24 },
    'Water Supply Issue':    { priority: 'Critical', hours: 12 },
    'Bathroom Tile Broken':  { priority: 'Low',      hours: 336 },
    'Water Tank Leakage':    { priority: 'High',     hours: 24  },
    'Geyser Not Working':    { priority: 'Medium',   hours: 72  },
  },
  'Carpentry': {
    'Broken Window':      { priority: 'Medium',   hours: 120 },
    'Broken Door Frame':  { priority: 'Medium',   hours: 168 },
    'Wardrobe Damage':    { priority: 'Low',      hours: 336 },
    'Staircase Railing':  { priority: 'High',     hours: 72  },
    'Roof Beam Damage':   { priority: 'Critical', hours: 24  },
    'Cupboard Lock':      { priority: 'Low',      hours: 240 },
  },
  'Painting': {
    'Wall Paint Peeling': { priority: 'Low',    hours: 504 },
    'Dampness / Fungus':  { priority: 'Medium', hours: 168 },
    'Exterior Paint':     { priority: 'Low',    hours: 720 },
    'Gate Painting':      { priority: 'Low',    hours: 720 },
  },
};

// ============================================================
// UNIQUE CODE GENERATOR
// ============================================================
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RAIL-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function ensureUniqueCode(pf_no: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { pf_no } });
  if (user?.unique_code) return user.unique_code;
  
  let code = generateUniqueCode();
  let attempts = 0;
  while (attempts < 10) {
    const exists = await prisma.user.findUnique({ where: { unique_code: code } });
    if (!exists) break;
    code = generateUniqueCode();
    attempts++;
  }
  
  await prisma.user.update({ where: { pf_no }, data: { unique_code: code } });
  return code;
}

// ============================================================
// BLOCKCHAIN HELPERS
// ============================================================
function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function recordAudit(
  ticketId: string,
  action: string,
  performedBy: string,
  gpsLocation?: string
) {
  const lastLedger = await prisma.auditLedger.findFirst({
    where: { ticket_id: ticketId },
    orderBy: { id: 'desc' },
  });

  const previousHash = lastLedger ? lastLedger.current_hash : 'GENESIS_BLOCK_0000000000000000';
  const dataString = `${ticketId}-${action}-${performedBy}-${new Date().toISOString()}-${gpsLocation || ''}-${previousHash}`;
  const currentHash = generateHash(dataString);

  await prisma.auditLedger.create({
    data: {
      ticket_id: ticketId,
      action,
      performed_by: performedBy,
      gps_location: gpsLocation,
      previous_hash: previousHash,
      current_hash: currentHash,
    },
  });
}

// ============================================================
// NOTIFICATION HELPER
// ============================================================
async function createNotification(userPf: string, title: string, body: string) {
  try {
    await prisma.notification.create({ data: { user_pf: userPf, title, body } });
  } catch (e) {
    console.error('Notification error:', e);
  }
}

// ============================================================
// CRON JOBS — SLA ESCALATION (Every Hour)
// ============================================================
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running SLA escalation check...');
  const now = new Date();

  const breachedTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['Submitted', 'Seen', 'In-Progress', 'Pending-Material'] },
      SLA_deadline: { lt: now },
    },
  });

  for (const t of breachedTickets) {
    const hoursBreached = (now.getTime() - new Date(t.SLA_deadline).getTime()) / (1000 * 60 * 60);
    let newFlag = t.flag_color;

    if (hoursBreached >= 168 && t.flag_color !== 'Red') newFlag = 'Red';
    else if (hoursBreached >= 72 && hoursBreached < 168 && t.flag_color !== 'Orange') newFlag = 'Orange';
    else if (hoursBreached >= 24 && hoursBreached < 72 && t.flag_color !== 'Yellow') newFlag = 'Yellow';

    if (newFlag !== t.flag_color) {
      await prisma.ticket.update({ where: { id: t.id }, data: { flag_color: newFlag } });
      await recordAudit(t.id, `SLA Escalation: Flag turned ${newFlag}`, 'SYSTEM');

      if (t.assigned_iow) {
        await createNotification(t.assigned_iow, `⚠️ SLA Breach – ${newFlag} Flag`, `Ticket #${t.id} (${t.category} - ${t.sub_category}) has been escalated to ${newFlag} flag.`);
      }
      await createNotification(t.pf_no, `🚨 Your ticket #${t.id} SLA breached (${newFlag})`, `${t.category} - ${t.sub_category} complaint has exceeded SLA deadline.`);
    }
  }

  // Auto-flag unassigned tickets > 4 hours old
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const unassigned = await prisma.ticket.findMany({
    where: { status: 'Submitted', assigned_iow: null, created_at: { lt: fourHoursAgo } },
    include: { user: { select: { pf_no: true } } },
  });
  // Find all SSEs and notify them
  const sses = await prisma.user.findMany({ where: { role: 'SSE' }, select: { pf_no: true } });
  for (const t of unassigned) {
    for (const sse of sses) {
      await createNotification(sse.pf_no, '🚨 Unassigned Ticket Alert', `Ticket #${t.id} (${t.category}) has been unassigned for over 4 hours. Please assign an IOW.`);
    }
  }

  console.log(`[CRON] Processed ${breachedTickets.length} breached, ${unassigned.length} unassigned tickets.`);
});

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/hrms-otp', (_req, res) => {
  res.json({ success: true, message: 'OTP sent to registered mobile (Mock Mode).', mock: true });
});

app.post('/api/auth/hrms-verify', (_req, res) => {
  res.json({ success: true, message: 'OTP verified (Mock Mode).', mock: true });
});

// ============================================================
// PROFILE ROUTES
// ============================================================
app.post('/api/profile', async (req, res) => {
  const { firebase_uid, email, pf_no, name, mobile, department, hq, designation, quarter_type, quarter_no, quarter_gps_lat, quarter_gps_lng, role, role_pin } = req.body;
  try {
    let finalRole = role || 'Employee';
    let isAdmin = false;

    if (email === 'parmalsingh26@gmail.com') {
      finalRole = 'Admin';
      isAdmin = true;
    } else if (finalRole !== 'Employee') {
      const pinRecord = await prisma.rolePin.findUnique({ where: { role: finalRole } });
      if (!pinRecord || pinRecord.pin !== role_pin) {
        return res.status(400).json({ success: false, error: `Invalid verification PIN for role ${finalRole}` });
      }
    }

    // Generate unique code
    let uniqueCode = generateUniqueCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.user.findUnique({ where: { unique_code: uniqueCode } });
      if (!exists) break;
      uniqueCode = generateUniqueCode();
      attempts++;
    }

    const user = await prisma.user.create({
      data: {
        firebase_uid, email, pf_no, name, mobile, department, hq,
        designation, quarter_type, quarter_no,
        quarter_gps_lat: quarter_gps_lat ? parseFloat(quarter_gps_lat) : null,
        quarter_gps_lng: quarter_gps_lng ? parseFloat(quarter_gps_lng) : null,
        role: finalRole,
        is_admin: isAdmin,
        unique_code: uniqueCode,
      },
    });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/profile/:uid', async (req, res) => {
  const { mobile, department, hq, designation, quarter_type, quarter_no, quarter_gps_lat, quarter_gps_lng } = req.body;
  try {
    const user = await prisma.user.update({
      where: { firebase_uid: req.params.uid },
      data: {
        mobile, department, hq, designation, quarter_type, quarter_no,
        quarter_gps_lat: quarter_gps_lat ? parseFloat(quarter_gps_lat) : null,
        quarter_gps_lng: quarter_gps_lng ? parseFloat(quarter_gps_lng) : null,
      },
    });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/profile/:uid', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { firebase_uid: req.params.uid } });
  
  if (user) {
    // Ensure unique code is assigned
    if (!user.unique_code) {
      const code = await ensureUniqueCode(user.pf_no);
      res.json({ success: true, user: { ...user, unique_code: code } });
    } else {
      res.json({ success: true, user });
    }
  } else {
    // ADMIN AUTO-PROVISIONING BYPASS
    const email = req.query.email as string;
    if (email === 'parmalsingh26@gmail.com') {
      try {
        const adminUser = await prisma.user.create({
          data: {
            firebase_uid: req.params.uid,
            email: email,
            pf_no: 'ADMIN-MASTER',
            name: 'Master Admin',
            mobile: '0000000000',
            role: 'Admin',
            is_admin: true,
            is_on_leave: false
          }
        });
        const code = await ensureUniqueCode(adminUser.pf_no);
        res.json({ success: true, user: { ...adminUser, unique_code: code } });
      } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
      }
    } else {
      res.status(404).json({ success: false, message: 'Not found' });
    }
  }
});

// Admin: edit name
app.put('/api/admin/users/:pf/name', async (req, res) => {
  const { name, admin_pf } = req.body;
  try {
    const admin = await prisma.user.findUnique({ where: { pf_no: admin_pf } });
    if (!admin || !admin.is_admin) return res.status(403).json({ success: false, error: 'Unauthorized' });
    const user = await prisma.user.update({ where: { pf_no: req.params.pf }, data: { name } });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Admin: edit PF
app.put('/api/admin/users/:pf/pf', async (req, res) => {
  const { new_pf, admin_pf } = req.body;
  try {
    const admin = await prisma.user.findUnique({ where: { pf_no: admin_pf } });
    if (!admin || !admin.is_admin) return res.status(403).json({ success: false, error: 'Unauthorized' });
    const user = await prisma.user.update({ where: { pf_no: req.params.pf }, data: { pf_no: new_pf } });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Employee: request name change
app.post('/api/profile/name-change-request', async (req, res) => {
  const { pf_no, new_name, reason } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { pf_no } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const request = await prisma.nameChangeRequest.create({
      data: { user_pf: pf_no, old_name: user.name, new_name, reason },
    });
    // Notify SSE/Admin
    const admins = await prisma.user.findMany({ where: { role: { in: ['Admin', 'SSE'] } }, select: { pf_no: true } });
    for (const a of admins) {
      await createNotification(a.pf_no, '📝 Name Change Request', `${user.name} (PF: ${pf_no}) requests name change to: ${new_name}`);
    }
    res.json({ success: true, request });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get name change requests
app.get('/api/admin/name-change-requests', async (_req, res) => {
  const requests = await prisma.nameChangeRequest.findMany({
    where: { status: 'Pending' },
    include: { user: { select: { name: true, pf_no: true, email: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, requests });
});

// Approve/Reject name change
app.put('/api/admin/name-change/:id', async (req, res) => {
  const { status, reviewed_by } = req.body;
  try {
    const request = await prisma.nameChangeRequest.update({
      where: { id: req.params.id },
      data: { status, reviewed_by, reviewed_at: new Date() },
    });
    if (status === 'Approved') {
      await prisma.user.update({ where: { pf_no: request.user_pf }, data: { name: request.new_name } });
      await createNotification(request.user_pf, '✅ Name Change Approved', `Your name has been updated to: ${request.new_name}`);
    } else {
      await createNotification(request.user_pf, '❌ Name Change Rejected', `Your name change request to "${request.new_name}" was rejected.`);
    }
    res.json({ success: true, request });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Toggle IOW leave status
app.put('/api/admin/users/:pf/leave', async (req, res) => {
  const { is_on_leave } = req.body;
  try {
    const user = await prisma.user.update({ where: { pf_no: req.params.pf }, data: { is_on_leave } });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/users/iows', async (_req, res) => {
  const iows = await prisma.user.findMany({
    where: { role: 'IOW' },
    select: { id: true, pf_no: true, name: true, designation: true, is_on_leave: true, average_rating: true, unique_code: true },
  });
  res.json({ success: true, iows });
});

// All users with unique codes (for DRM lookup)
app.get('/api/users/all-with-codes', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { pf_no: true, name: true, role: true, unique_code: true, email: true, department: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, users });
});

// Lookup by unique code
app.get('/api/users/by-code/:code', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { unique_code: req.params.code.toUpperCase() },
    select: { pf_no: true, name: true, role: true, unique_code: true, email: true, department: true, designation: true },
  });
  if (user) res.json({ success: true, user });
  else res.status(404).json({ success: false, message: 'No user found with this code' });
});

// ============================================================
// SLA MATRIX ENDPOINT
// ============================================================
app.get('/api/sla-matrix', (_req, res) => {
  res.json({ success: true, matrix: SLA_MATRIX });
});

// ============================================================
// TICKET ROUTES
// ============================================================
app.post('/api/tickets', async (req, res) => {
  const { pf_no, category, sub_category, sub_categories, custom_issue, description } = req.body;

  let maxHours = 48;
  let highestPriority = 'Medium';
  const priorityOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };

  const issuesToCheck = sub_categories && sub_categories.length > 0 ? sub_categories : (sub_category ? [sub_category] : []);
  
  if (issuesToCheck.length > 0) {
    issuesToCheck.forEach((issue: string) => {
      const entry = SLA_MATRIX[category]?.[issue];
      if (entry) {
        if (entry.hours < maxHours) maxHours = entry.hours;
        if (priorityOrder[entry.priority as keyof typeof priorityOrder] > priorityOrder[highestPriority as keyof typeof priorityOrder]) {
          highestPriority = entry.priority;
        }
      }
    });
  } else if (custom_issue) {
    maxHours = 72;
    highestPriority = 'Medium';
  }

  const SLA_deadline = new Date();
  SLA_deadline.setHours(SLA_deadline.getHours() + maxHours);

  let primarySubCategory = 'Custom Issue';
  if (sub_categories && sub_categories.length > 0) {
    primarySubCategory = sub_categories.join(', ');
  } else if (sub_category) {
    primarySubCategory = sub_category;
  }

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const previousIssues = await prisma.ticket.count({
      where: { pf_no, category, created_at: { gte: sixMonthsAgo } },
    });
    const major_overhaul = previousIssues >= 3;

    const ticket = await prisma.ticket.create({
      data: { 
        pf_no, category, 
        sub_category: primarySubCategory, 
        sub_categories: sub_categories ? JSON.stringify(sub_categories) : null,
        custom_issue, description, SLA_deadline, 
        priority: highestPriority, major_overhaul 
      },
    });

    await recordAudit(ticket.id, 'Ticket Submitted', pf_no);
    if (major_overhaul) {
      await createNotification(pf_no, '⚠️ Major Overhaul Flagged', `Ticket #${ticket.id} has been flagged for Major Overhaul (3rd repeat issue in 6 months).`);
    }

    res.json({ success: true, ticket });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/tickets', async (req, res) => {
  const { pf_no, role, iow_pf, category, status: filterStatus, priority: filterPriority } = req.query;
  let whereClause: any = {};

  if (role === 'Employee') {
    whereClause.pf_no = pf_no as string;
  } else if (role === 'IOW' && iow_pf) {
    whereClause.assigned_iow = iow_pf as string;
    whereClause.status = { notIn: ['Closed'] };
  } else if (role === 'SSE') {
    whereClause.status = { notIn: ['Closed'] };
  }
  // DRM sees all — no extra filter

  if (category) whereClause.category = category as string;
  if (filterStatus && filterStatus !== 'All') whereClause.status = filterStatus as string;
  if (filterPriority && filterPriority !== 'All') whereClause.priority = filterPriority as string;

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    orderBy: role === 'Employee' ? { created_at: 'desc' } : { SLA_deadline: 'asc' },
    include: {
      user: { select: { name: true, pf_no: true, unique_code: true, quarter_type: true, quarter_no: true, quarter_gps_lat: true, quarter_gps_lng: true } },
      iow: { select: { name: true, pf_no: true, unique_code: true, designation: true } },
      visit_schedules: { orderBy: { scheduled_at: 'desc' }, take: 1 },
    },
  });

  res.json({ success: true, tickets });
});

// Pending tickets with full owner details for SSE
app.get('/api/tickets/pending-with-owners', async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { status: { notIn: ['Closed', 'Resolved'] } },
    orderBy: { SLA_deadline: 'asc' },
    include: {
      user: { select: { name: true, pf_no: true, unique_code: true, quarter_type: true, quarter_no: true, department: true } },
      iow: { select: { name: true, pf_no: true, unique_code: true, designation: true } },
      visit_schedules: { orderBy: { scheduled_at: 'desc' }, take: 1 },
    },
  });
  res.json({ success: true, tickets });
});

// Full-text search
app.get('/api/tickets/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, tickets: [] });
  
  const tickets = await prisma.ticket.findMany({
    where: {
      OR: [
        { pf_no: { contains: q as string } },
        { category: { contains: q as string, mode: 'insensitive' } },
        { sub_category: { contains: q as string, mode: 'insensitive' } },
        { description: { contains: q as string, mode: 'insensitive' } },
        { id: { contains: q as string } },
      ],
    },
    include: {
      user: { select: { name: true, pf_no: true, unique_code: true } },
      iow: { select: { name: true, pf_no: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });
  res.json({ success: true, tickets });
});

app.get('/api/tickets/:id', async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { name: true, pf_no: true, unique_code: true, quarter_type: true, quarter_no: true } },
      iow: { select: { name: true, pf_no: true, unique_code: true, designation: true } },
      visit_schedules: { orderBy: { scheduled_at: 'desc' } },
    },
  });
  if (ticket) res.json({ success: true, ticket });
  else res.status(404).json({ success: false, message: 'Not found' });
});

// Mark as Seen
app.post('/api/tickets/:id/seen', async (req, res) => {
  const { pf_no } = req.body;
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'Seen' },
  });
  await recordAudit(ticket.id, 'Ticket Seen by IOW', pf_no);
  await createNotification(ticket.pf_no, '👁️ Your Complaint is Being Reviewed', `Ticket #${ticket.id} has been seen by the IOW and will be attended soon.`);
  res.json({ success: true, ticket });
});

// Mark In-Progress
app.post('/api/tickets/:id/inprogress', async (req, res) => {
  const { pf_no } = req.body;
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'In-Progress' },
  });
  await recordAudit(ticket.id, 'Work Started by IOW', pf_no);
  await createNotification(ticket.pf_no, '🔧 Work Started on Your Complaint', `Ticket #${ticket.id}: IOW has started working on your ${ticket.category} - ${ticket.sub_category} issue.`);
  res.json({ success: true, ticket });
});

// Mark Pending-Material (Hold)
app.post('/api/tickets/:id/hold', async (req, res) => {
  const { pf_no, hold_reason } = req.body;
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'Pending-Material', hold_reason, pending_material_at: new Date() },
  });
  await recordAudit(ticket.id, `Marked Pending-Material: ${hold_reason}`, pf_no);
  await createNotification(ticket.pf_no, '⏳ Work On Hold – Material Pending', `Ticket #${ticket.id} is on hold. Reason: ${hold_reason}. SSE has been notified.`);
  res.json({ success: true, ticket });
});

// Assign to IOW (SSE action)
app.post('/api/tickets/:id/assign', async (req, res) => {
  const { iow_pf, assigned_by, reassign_reason } = req.body;
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { assigned_iow: iow_pf, reassign_reason: reassign_reason || null },
  });
  await recordAudit(ticket.id, `Assigned to IOW: ${iow_pf}${reassign_reason ? ` | Reason: ${reassign_reason}` : ''}`, assigned_by);
  await createNotification(iow_pf, '📋 New Ticket Assigned to You', `Ticket #${ticket.id} (${ticket.category} - ${ticket.sub_category}) has been assigned to you. SLA: ${new Date(ticket.SLA_deadline).toLocaleString()}`);
  res.json({ success: true, ticket });
});

// Geo-Resolve (IOW marks as Resolved with GPS check)
app.post('/api/tickets/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { pf_no, lat, lng, photoUrl, work_photos, site_remark, actual_cost } = req.body;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

  const employee = await prisma.user.findUnique({ where: { pf_no: ticket.pf_no } });
  const quarterLat = employee?.quarter_gps_lat ?? 28.6139;
  const quarterLng = employee?.quarter_gps_lng ?? 77.2090;

  // Haversine formula
  const R = 6371e3;
  const φ1 = (lat * Math.PI) / 180;
  const φ2 = (quarterLat * Math.PI) / 180;
  const Δφ = ((quarterLat - lat) * Math.PI) / 180;
  const Δλ = ((quarterLng - lng) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (d > 50) {
    return res.status(400).json({
      success: false,
      message: `Geo-fencing failed: You are ${Math.round(d)}m away from the quarter. Must be within 50m.`,
    });
  }

  const closure_otp = Math.floor(1000 + Math.random() * 9000).toString();

  const updated = await prisma.ticket.update({
    where: { id },
    data: { 
      status: 'Resolved', resolved_photo: photoUrl, closure_otp,
      work_photos: work_photos ? JSON.stringify(work_photos) : null,
      site_remark: site_remark || null,
      actual_cost: actual_cost ? parseFloat(actual_cost) : null,
    },
  });

  await recordAudit(updated.id, 'Work Completed – Marked Resolved', pf_no, `${lat.toFixed(6)},${lng.toFixed(6)}`);
  await createNotification(ticket.pf_no, '✅ Your Complaint Has Been Resolved!', `Ticket #${ticket.id} is resolved. Check your dashboard for the OTP to officially close the ticket.`);

  res.json({ success: true, ticket: updated });
});

// Close ticket via OTP handshake
app.post('/api/tickets/:id/close', async (req, res) => {
  const { otp, pf_no } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });

  if (!ticket || ticket.closure_otp !== otp) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
  }

  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'Closed', closed_at: new Date(), closure_otp: null },
  });

  await recordAudit(updated.id, 'Ticket Officially Closed (OTP Verified)', pf_no);
  if (ticket.assigned_iow) {
    await createNotification(ticket.assigned_iow, '🏁 Ticket Closed', `Ticket #${ticket.id} has been officially closed by the employee. Well done!`);
  }
  res.json({ success: true, ticket: updated });
});

// Employee rates a closed ticket
app.post('/api/tickets/:id/rate', async (req, res) => {
  const { rating, rating_comment, pf_no } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
  
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket || ticket.status !== 'Closed') return res.status(400).json({ success: false, message: 'Can only rate closed tickets' });
  if (ticket.pf_no !== pf_no) return res.status(403).json({ success: false, message: 'Unauthorized' });

  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { rating, rating_comment: rating_comment || null },
  });

  // Update IOW average rating
  if (ticket.assigned_iow) {
    const iowTickets = await prisma.ticket.findMany({
      where: { assigned_iow: ticket.assigned_iow, rating: { not: null } },
      select: { rating: true },
    });
    const avg = iowTickets.reduce((sum, t) => sum + (t.rating || 0), 0) / iowTickets.length;
    await prisma.user.update({ where: { pf_no: ticket.assigned_iow }, data: { average_rating: Math.round(avg * 10) / 10 } });
    await createNotification(ticket.assigned_iow, `⭐ You received a ${rating}-star rating`, `Employee rated ticket #${ticket.id}: ${rating_comment || 'No comment'}`);
  }

  res.json({ success: true, ticket: updated });
});

// Employee escalates urgency (Still Not Resolved)
app.post('/api/tickets/:id/escalate-urgency', async (req, res) => {
  const { pf_no } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ success: false });

  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { urgency_escalated: true, urgency_escalated_at: new Date() },
  });

  await recordAudit(req.params.id, 'Employee marked: Still Not Resolved (Urgency Escalated)', pf_no);
  
  // Notify SSE
  const sses = await prisma.user.findMany({ where: { role: 'SSE' }, select: { pf_no: true } });
  for (const sse of sses) {
    await createNotification(sse.pf_no, '🆘 Employee Escalated Urgency', `Employee (PF: ${pf_no}) says ticket #${ticket.id} (${ticket.category}) is STILL NOT RESOLVED. Immediate action needed.`);
  }
  if (ticket.assigned_iow) {
    await createNotification(ticket.assigned_iow, '🆘 Urgency Alert from Employee', `Employee has escalated ticket #${ticket.id} as STILL NOT RESOLVED. Please take immediate action.`);
  }
  
  res.json({ success: true, ticket: updated });
});

// Employee requests reopen
app.post('/api/tickets/:id/reopen', async (req, res) => {
  const { pf_no, reason } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket || ticket.status !== 'Closed') return res.status(400).json({ success: false, message: 'Only closed tickets can be reopened' });
  
  // Only within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (!ticket.closed_at || new Date(ticket.closed_at) < sevenDaysAgo) {
    return res.status(400).json({ success: false, message: 'Reopen window expired (7 days)' });
  }

  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'Submitted', reopen_requested: true, reopened_at: new Date(), closed_at: null, closure_otp: null },
  });

  await recordAudit(req.params.id, `Ticket Reopened by Employee. Reason: ${reason}`, pf_no);
  const sses = await prisma.user.findMany({ where: { role: 'SSE' }, select: { pf_no: true } });
  for (const sse of sses) {
    await createNotification(sse.pf_no, '🔄 Ticket Reopened', `Employee (${pf_no}) reopened ticket #${ticket.id}. Reason: ${reason}`);
  }
  
  res.json({ success: true, ticket: updated });
});

// Add cost estimate (IOW)
app.post('/api/tickets/:id/cost-estimate', async (req, res) => {
  const { estimated_cost, contractor_name, pf_no } = req.body;
  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { estimated_cost: parseFloat(estimated_cost), contractor_name: contractor_name || null },
  });
  await recordAudit(req.params.id, `Cost Estimate Submitted: ₹${estimated_cost}${contractor_name ? ` | Contractor: ${contractor_name}` : ''}`, pf_no);
  res.json({ success: true, ticket: updated });
});

// IOW visit schedule
app.post('/api/tickets/:id/visit-schedule', async (req, res) => {
  const { iow_pf, scheduled_at, time_slot, notes, created_by } = req.body;
  const schedule = await prisma.visitSchedule.create({
    data: {
      ticket_id: req.params.id,
      iow_pf,
      scheduled_at: new Date(scheduled_at),
      time_slot,
      notes: notes || null,
      created_by,
    },
  });
  await prisma.ticket.update({ where: { id: req.params.id }, data: { visit_scheduled_at: new Date(scheduled_at), visit_notes: notes || null } });
  
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (ticket) {
    await createNotification(ticket.pf_no, '📅 Visit Scheduled!', `An IOW will visit your quarter on ${new Date(scheduled_at).toLocaleDateString('en-IN')} between ${time_slot}. Please be available.`);
    await createNotification(iow_pf, '📅 Visit Scheduled for You', `You have a scheduled visit for Ticket #${req.params.id} on ${new Date(scheduled_at).toLocaleDateString('en-IN')} between ${time_slot}.`);
  }
  
  res.json({ success: true, schedule });
});

// IOW upcoming visit schedule
app.get('/api/dashboard/iow/:pf/schedule', async (req, res) => {
  const now = new Date();
  const schedules = await prisma.visitSchedule.findMany({
    where: { iow_pf: req.params.pf, scheduled_at: { gte: now }, status: 'Scheduled' },
    include: { ticket: { include: { user: { select: { name: true, pf_no: true, quarter_type: true, quarter_no: true, quarter_gps_lat: true, quarter_gps_lng: true } } } } },
    orderBy: { scheduled_at: 'asc' },
  });
  res.json({ success: true, schedules });
});

// ============================================================
// SLA EXTENSION REQUESTS
// ============================================================
app.post('/api/tickets/:id/extension', async (req, res) => {
  const { iow_pf, reason, requested_hours } = req.body;
  const request = await prisma.iOWExtensionRequest.create({
    data: { ticket_id: req.params.id, iow_pf, reason, requested_hours: parseInt(requested_hours) },
  });
  await recordAudit(req.params.id, `SLA Extension Requested: +${requested_hours}h by ${iow_pf}`, iow_pf);
  res.json({ success: true, request });
});

app.get('/api/extensions/pending', async (_req, res) => {
  const requests = await prisma.iOWExtensionRequest.findMany({
    where: { status: 'Pending' },
    include: { ticket: true, iow: true },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, requests });
});

app.put('/api/extensions/:reqId', async (req, res) => {
  const { status, approved_by } = req.body;
  const request = await prisma.iOWExtensionRequest.update({
    where: { id: req.params.reqId },
    data: { status },
    include: { ticket: true },
  });

  if (status === 'Approved') {
    const newDeadline = new Date(request.ticket.SLA_deadline);
    newDeadline.setHours(newDeadline.getHours() + request.requested_hours);
    await prisma.ticket.update({ where: { id: request.ticket_id }, data: { SLA_deadline: newDeadline } });
    await recordAudit(request.ticket_id, `SLA Extended by +${request.requested_hours}h (Approved by SSE)`, approved_by);
    await createNotification(request.iow_pf, '✅ SLA Extension Approved', `Your request for +${request.requested_hours}h extension on Ticket #${request.ticket_id} has been approved.`);
  } else {
    await createNotification(request.iow_pf, '❌ SLA Extension Rejected', `Your extension request for Ticket #${request.ticket_id} was rejected. Please complete work on time.`);
  }

  res.json({ success: true, request });
});

// ============================================================
// AUDIT / BLOCKCHAIN ROUTES
// ============================================================
app.get('/api/audit/:ticketId', async (req, res) => {
  const ledger = await prisma.auditLedger.findMany({
    where: { ticket_id: req.params.ticketId },
    orderBy: { id: 'asc' },
  });

  let tampered = false;
  for (let i = 1; i < ledger.length; i++) {
    if (ledger[i].previous_hash !== ledger[i - 1].current_hash) {
      tampered = true;
    }
  }

  res.json({ success: true, ledger, tampered });
});

// ============================================================
// NOTIFICATION ROUTES
// ============================================================
app.get('/api/notifications/:pf', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { user_pf: req.params.pf },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  res.json({ success: true, notifications });
});

app.post('/api/notifications/read', async (req, res) => {
  const { user_pf } = req.body;
  await prisma.notification.updateMany({
    where: { user_pf, is_read: false },
    data: { is_read: true },
  });
  res.json({ success: true });
});

// Admin broadcast notification
app.post('/api/admin/broadcast', async (req, res) => {
  const { title, body, sent_by, target_role } = req.body;
  try {
    const whereClause = target_role ? { role: target_role } : {};
    const users = await prisma.user.findMany({ where: whereClause, select: { pf_no: true } });
    await Promise.all(users.map(u => createNotification(u.pf_no, title, body)));
    await prisma.broadcast.create({ data: { title, body, sent_by, target_role: target_role || null } });
    res.json({ success: true, sent_to: users.length });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================
// REPORTS & ANALYTICS
// ============================================================
app.get('/api/reports/monthly', async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tickets = await prisma.ticket.findMany({
    where: { created_at: { gte: thirtyDaysAgo } },
  });

  const iowStats: Record<string, { total: number; closed: number; breached: number; name?: string; avgRating?: number }> = {};
  const now = new Date();

  for (const t of tickets) {
    const key = t.assigned_iow || 'Unassigned';
    if (!iowStats[key]) iowStats[key] = { total: 0, closed: 0, breached: 0 };
    iowStats[key].total++;
    if (t.status === 'Closed') iowStats[key].closed++;
    if (t.SLA_deadline < now && t.status !== 'Closed') iowStats[key].breached++;
  }

  const iowList = await prisma.user.findMany({ where: { role: 'IOW' }, select: { pf_no: true, name: true, average_rating: true } });
  iowList.forEach(iow => {
    if (iowStats[iow.pf_no]) {
      iowStats[iow.pf_no].name = iow.name;
      iowStats[iow.pf_no].avgRating = iow.average_rating || undefined;
    }
  });

  const totalTickets = tickets.length;
  const closedTickets = tickets.filter(t => t.status === 'Closed').length;
  const slaBreaches = tickets.filter(t => t.SLA_deadline < now && t.status !== 'Closed').length;
  const redFlags = tickets.filter(t => t.flag_color === 'Red').length;
  const majorOverhauls = tickets.filter(t => t.major_overhaul).length;

  const categoryBreakdown: Record<string, number> = {};
  tickets.forEach(t => { categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + 1; });

  const totalCost = tickets.reduce((sum, t) => sum + (t.estimated_cost || 0), 0);
  const avgRating = tickets.filter(t => t.rating).reduce((sum, t, _, arr) => sum + (t.rating || 0) / arr.length, 0);
  const slaComplianceRate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;

  res.json({
    success: true,
    report: {
      period: { from: thirtyDaysAgo.toISOString(), to: now.toISOString() },
      totalTickets, closedTickets, slaBreaches, redFlags, majorOverhauls,
      categoryBreakdown, iowStats,
      totalCost: Math.round(totalCost),
      avgRating: Math.round(avgRating * 10) / 10,
      slaComplianceRate,
    },
  });
});

app.get('/api/reports/weekly', async (_req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const now = new Date();

  const tickets = await prisma.ticket.findMany({ where: { created_at: { gte: sevenDaysAgo } } });
  const totalTickets = tickets.length;
  const closedTickets = tickets.filter(t => t.status === 'Closed').length;
  const slaBreaches = tickets.filter(t => t.SLA_deadline < now && t.status !== 'Closed').length;
  const categoryBreakdown: Record<string, number> = {};
  tickets.forEach(t => { categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + 1; });

  res.json({ success: true, report: { period: '7 days', totalTickets, closedTickets, slaBreaches, categoryBreakdown } });
});

app.get('/api/reports/iow-ratings', async (_req, res) => {
  const iows = await prisma.user.findMany({
    where: { role: 'IOW' },
    select: { pf_no: true, name: true, designation: true, average_rating: true, unique_code: true },
    orderBy: { average_rating: 'desc' },
  });
  res.json({ success: true, iows });
});

app.get('/api/reports/cost', async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { estimated_cost: { not: null } },
    select: { category: true, estimated_cost: true, actual_cost: true, status: true, created_at: true },
  });
  const totalEstimated = tickets.reduce((s, t) => s + (t.estimated_cost || 0), 0);
  const totalActual = tickets.reduce((s, t) => s + (t.actual_cost || 0), 0);
  const byCategory: Record<string, number> = {};
  tickets.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + (t.estimated_cost || 0); });
  res.json({ success: true, totalEstimated: Math.round(totalEstimated), totalActual: Math.round(totalActual), byCategory });
});

app.get('/api/reports/heatmap', async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { status: { notIn: ['Closed'] } },
    include: { user: { select: { quarter_gps_lat: true, quarter_gps_lng: true, quarter_no: true, quarter_type: true, name: true, pf_no: true } } },
  });

  const heatmapData = tickets
    .filter(t => t.user.quarter_gps_lat && t.user.quarter_gps_lng)
    .map(t => ({
      lat: t.user.quarter_gps_lat,
      lng: t.user.quarter_gps_lng,
      quarter: `${t.user.quarter_type} - ${t.user.quarter_no}`,
      flag: t.flag_color,
      priority: t.priority,
      employee_name: t.user.name,
      employee_pf: t.user.pf_no,
      category: t.category,
    }));

  res.json({ success: true, heatmapData });
});

// Division health score (0-100)
app.get('/api/reports/health-score', async (_req, res) => {
  const now = new Date();
  const tickets = await prisma.ticket.findMany({ where: { created_at: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) } } });
  
  if (tickets.length === 0) return res.json({ success: true, score: 100, grade: 'A+' });

  const total = tickets.length;
  const closed = tickets.filter(t => t.status === 'Closed').length;
  const redFlags = tickets.filter(t => t.flag_color === 'Red').length;
  const overdue = tickets.filter(t => t.SLA_deadline < now && t.status !== 'Closed').length;
  const majorOverhauls = tickets.filter(t => t.major_overhaul).length;

  // Score formula
  const closureScore = (closed / total) * 40;
  const overdueScore = Math.max(0, 30 - (overdue / total) * 60);
  const flagScore = Math.max(0, 20 - (redFlags / total) * 40);
  const overhaulScore = Math.max(0, 10 - (majorOverhauls / total) * 20);
  const score = Math.round(closureScore + overdueScore + flagScore + overhaulScore);
  
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
  res.json({ success: true, score, grade, breakdown: { closureScore, overdueScore, flagScore, overhaulScore } });
});

// ============================================================
// ADMIN & ROLE PIN ROUTES
// ============================================================
app.get('/api/admin/users', async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { created_at: 'desc' } });
  res.json({ success: true, users });
});

app.put('/api/admin/users/:pf/role', async (req, res) => {
  const { role } = req.body;
  try {
    const user = await prisma.user.update({ where: { pf_no: req.params.pf }, data: { role } });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/pins', async (req, res) => {
  const pins = await prisma.rolePin.findMany();
  res.json({ success: true, pins });
});

app.post('/api/admin/pins', async (req, res) => {
  const { role, pin } = req.body;
  try {
    const rolePin = await prisma.rolePin.upsert({
      where: { role },
      update: { pin, updated_at: new Date() },
      create: { role, pin },
    });
    res.json({ success: true, rolePin });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Admin Ticket Command Endpoints
app.put('/api/admin/tickets/:id', async (req, res) => {
  try {
    const data = req.body;
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data
    });
    res.json({ success: true, ticket });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/tickets/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Delete cascading relations manually if necessary, or just rely on Prisma cascade if configured
    await prisma.auditLedger.deleteMany({ where: { ticket_id: id } });
    await prisma.visitSchedule.deleteMany({ where: { ticket_id: id } });
    await prisma.iOWExtensionRequest.deleteMany({ where: { ticket_id: id } });
    
    await prisma.ticket.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});


app.post('/api/auth/verify-role-pin', async (req, res) => {
  const { pf_no, role, pin } = req.body;
  
  if (!role) return res.status(400).json({ success: false, message: 'Role is required.' });

  const rolePin = await prisma.rolePin.findUnique({ where: { role } });
  if (!rolePin || rolePin.pin !== pin) {
    return res.status(400).json({ success: false, message: 'Invalid PIN for this role.' });
  }

  try {
    const user = await prisma.user.update({ where: { pf_no }, data: { role } });
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================
// VITE / STATIC FILE SERVER
// ============================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚂 RailAwaas Care Server running on http://localhost:${PORT}`);
  });
}

startServer();
