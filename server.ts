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

      // Notify assigned IOW
      if (t.assigned_iow) {
        await createNotification(t.assigned_iow, `⚠️ SLA Breach – ${newFlag} Flag`, `Ticket #${t.id} (${t.category} - ${t.sub_category}) has been escalated to ${newFlag} flag.`);
      }
      // Notify ticket owner
      await createNotification(t.pf_no, `🚨 Your ticket #${t.id} SLA breached (${newFlag})`, `${t.category} - ${t.sub_category} complaint has exceeded SLA deadline.`);
    }
  }
  console.log(`[CRON] Processed ${breachedTickets.length} breached tickets.`);
});

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/hrms-otp', (_req, res) => {
  // MOCK — Replace endpoint URL to activate real HRMS integration
  res.json({
    success: true,
    message: 'OTP sent to registered mobile (Mock Mode).',
    mock: true,
  });
});

app.post('/api/auth/hrms-verify', (_req, res) => {
  // MOCK — Replace with real OTP verification API call
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

    // Auto-admin for the creator
    if (email === 'parmalsingh26@gmail.com') {
      finalRole = 'Admin';
      isAdmin = true;
    } else if (finalRole !== 'Employee') {
      // Verify PIN for elevated roles
      const pinRecord = await prisma.rolePin.findUnique({ where: { role: finalRole } });
      if (!pinRecord || pinRecord.pin !== role_pin) {
        return res.status(400).json({ success: false, error: `Invalid verification PIN for role ${finalRole}` });
      }
    }

    const user = await prisma.user.create({
      data: {
        firebase_uid, email, pf_no, name, mobile, department, hq,
        designation, quarter_type, quarter_no,
        quarter_gps_lat: quarter_gps_lat ? parseFloat(quarter_gps_lat) : null,
        quarter_gps_lng: quarter_gps_lng ? parseFloat(quarter_gps_lng) : null,
        role: finalRole,
        is_admin: isAdmin,
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
  if (user) res.json({ success: true, user });
  else res.status(404).json({ success: false, message: 'Not found' });
});

app.get('/api/users/iows', async (_req, res) => {
  const iows = await prisma.user.findMany({
    where: { role: 'IOW' },
    select: { id: true, pf_no: true, name: true, designation: true },
  });
  res.json({ success: true, iows });
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

  // Calculate SLA based on multi-select or single
  const issuesToCheck = sub_categories && sub_categories.length > 0 ? sub_categories : (sub_category ? [sub_category] : []);
  
  if (issuesToCheck.length > 0) {
    issuesToCheck.forEach((issue: string) => {
      const entry = SLA_MATRIX[category]?.[issue];
      if (entry) {
        if (entry.hours < maxHours) maxHours = entry.hours; // Lower hours = tighter SLA
        if (priorityOrder[entry.priority as keyof typeof priorityOrder] > priorityOrder[highestPriority as keyof typeof priorityOrder]) {
          highestPriority = entry.priority;
        }
      }
    });
  } else if (custom_issue) {
    maxHours = 72; // Default for custom issues
    highestPriority = 'Medium';
  }

  const SLA_deadline = new Date();
  SLA_deadline.setHours(SLA_deadline.getHours() + maxHours);

  // Construct primary display string
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
        pf_no, 
        category, 
        sub_category: primarySubCategory, 
        sub_categories: sub_categories ? JSON.stringify(sub_categories) : null,
        custom_issue,
        description, 
        SLA_deadline, 
        priority: highestPriority, 
        major_overhaul 
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
  const { pf_no, role, iow_pf } = req.query;
  let tickets: any[] = [];

  if (role === 'Employee') {
    tickets = await prisma.ticket.findMany({
      where: { pf_no: pf_no as string },
      orderBy: { created_at: 'desc' },
    });
  } else if (role === 'IOW' && iow_pf) {
    tickets = await prisma.ticket.findMany({
      where: { assigned_iow: iow_pf as string, status: { notIn: ['Closed'] } },
      orderBy: { SLA_deadline: 'asc' },
    });
  } else if (role === 'SSE') {
    tickets = await prisma.ticket.findMany({
      where: { status: { notIn: ['Closed'] } },
      orderBy: { SLA_deadline: 'asc' },
    });
  } else {
    // DRM sees all
    tickets = await prisma.ticket.findMany({ orderBy: { SLA_deadline: 'asc' } });
  }

  res.json({ success: true, tickets });
});

app.get('/api/tickets/:id', async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
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
  const { iow_pf, assigned_by } = req.body;
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { assigned_iow: iow_pf },
  });
  await recordAudit(ticket.id, `Assigned to IOW: ${iow_pf}`, assigned_by);
  await createNotification(iow_pf, '📋 New Ticket Assigned to You', `Ticket #${ticket.id} (${ticket.category} - ${ticket.sub_category}) has been assigned to you. SLA: ${new Date(ticket.SLA_deadline).toLocaleString()}`);
  res.json({ success: true, ticket });
});

// Geo-Resolve (IOW marks as Resolved with GPS check)
app.post('/api/tickets/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { pf_no, lat, lng, photoUrl } = req.body;

  // Fetch ticket's employee to get their quarter GPS
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
    data: { status: 'Resolved', resolved_photo: photoUrl, closure_otp },
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
  const { status, approved_by } = req.body; // Approved or Rejected
  const request = await prisma.iOWExtensionRequest.update({
    where: { id: req.params.reqId },
    data: { status },
    include: { ticket: true },
  });

  if (status === 'Approved') {
    const newDeadline = new Date(request.ticket.SLA_deadline);
    newDeadline.setHours(newDeadline.getHours() + request.requested_hours);
    await prisma.ticket.update({
      where: { id: request.ticket_id },
      data: { SLA_deadline: newDeadline },
    });
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

  // Verify hash chain integrity
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
    take: 20,
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

// ============================================================
// REPORTS & ANALYTICS
// ============================================================
app.get('/api/reports/monthly', async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tickets = await prisma.ticket.findMany({
    where: { created_at: { gte: thirtyDaysAgo } },
  });

  // IOW performance — group by assigned_iow
  const iowStats: Record<string, { total: number; closed: number; breached: number; name?: string }> = {};
  const now = new Date();

  for (const t of tickets) {
    const key = t.assigned_iow || 'Unassigned';
    if (!iowStats[key]) iowStats[key] = { total: 0, closed: 0, breached: 0 };
    iowStats[key].total++;
    if (t.status === 'Closed') iowStats[key].closed++;
    if (t.SLA_deadline < now && t.status !== 'Closed') iowStats[key].breached++;
  }

  const iowList = await prisma.user.findMany({ where: { role: 'IOW' }, select: { pf_no: true, name: true } });
  iowList.forEach(iow => {
    if (iowStats[iow.pf_no]) iowStats[iow.pf_no].name = iow.name;
  });

  const totalTickets = tickets.length;
  const closedTickets = tickets.filter(t => t.status === 'Closed').length;
  const slaBreaches = tickets.filter(t => t.SLA_deadline < now && t.status !== 'Closed').length;
  const redFlags = tickets.filter(t => t.flag_color === 'Red').length;
  const majorOverhauls = tickets.filter(t => t.major_overhaul).length;

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  tickets.forEach(t => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + 1;
  });

  res.json({
    success: true,
    report: {
      period: { from: thirtyDaysAgo.toISOString(), to: now.toISOString() },
      totalTickets, closedTickets, slaBreaches, redFlags, majorOverhauls,
      categoryBreakdown,
      iowStats,
    },
  });
});

app.get('/api/reports/heatmap', async (_req, res) => {
  // Get all tickets with employee GPS data
  const tickets = await prisma.ticket.findMany({
    where: { status: { notIn: ['Closed'] } },
    include: { user: { select: { quarter_gps_lat: true, quarter_gps_lng: true, quarter_no: true, quarter_type: true } } },
  });

  const heatmapData = tickets
    .filter(t => t.user.quarter_gps_lat && t.user.quarter_gps_lng)
    .map(t => ({
      lat: t.user.quarter_gps_lat,
      lng: t.user.quarter_gps_lng,
      quarter: `${t.user.quarter_type} - ${t.user.quarter_no}`,
      flag: t.flag_color,
      priority: t.priority,
    }));

  res.json({ success: true, heatmapData });
});

// ============================================================
// ADMIN & ROLE PIN ROUTES
// ============================================================
app.get('/api/admin/users', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, users });
});

app.put('/api/admin/users/:pf/role', async (req, res) => {
  const { role } = req.body;
  try {
    const user = await prisma.user.update({
      where: { pf_no: req.params.pf },
      data: { role },
    });
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

app.post('/api/auth/verify-role-pin', async (req, res) => {
  const { pf_no, role, pin } = req.body;
  const rolePin = await prisma.rolePin.findUnique({ where: { role } });
  
  if (!rolePin || rolePin.pin !== pin) {
    return res.status(400).json({ success: false, message: 'Invalid PIN for this role.' });
  }

  try {
    const user = await prisma.user.update({
      where: { pf_no },
      data: { role },
    });
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
