const fs = require('fs');

const controllerPath = './backend/controllers/queueController.js';
let content = fs.readFileSync(controllerPath, 'utf8');

const markUrgentFunction = `
/**
 * @desc    Mark a waiting token as urgent
 * @route   POST /api/reception/queue/:id/urgent
 * @access  Private — receptionist
 */
const markUrgent = asyncHandler(async (req, res) => {
  const token = await QueueToken.findById(req.params.id);
  if (!token) {
    throw createError('Queue token not found', 404);
  }

  if (token.status !== 'waiting') {
    throw createError('Only waiting tokens can be marked as urgent', 400);
  }

  if (token.priority === 'urgent') {
    return res.json({ success: true, token }); // already urgent
  }

  token.priority = 'urgent';
  await token.save();

  if (token.appointment) {
    await Appointment.findByIdAndUpdate(token.appointment, {
      $set: { priority: 'urgent' }
    });
  }

  // Socket event (optional)
  req.app.get('io')?.emit('queue-updated', {
    message: 'Token marked as urgent',
    tokenNumber: token.tokenNumber
  });

  res.json({ success: true, token });
});
`;

content = content.replace('const moveBackToken = asyncHandler(async (req, res) => {', markUrgentFunction + '\nconst moveBackToken = asyncHandler(async (req, res) => {');

content = content.replace('moveBackToken,', 'moveBackToken,\n  markUrgent,');

fs.writeFileSync(controllerPath, content);
console.log('Controller updated.');

const routesPath = './backend/routes/queueRoutes.js';
let routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace('moveBackToken,', 'moveBackToken,\n  markUrgent,');
routesContent = routesContent.replace('// POST /api/reception/queue/:id/move-back -> move waiting token 3 positions back', '// POST /api/reception/queue/:id/urgent -> mark token as urgent\nrouter.post(\'/:id/urgent\', ...receptionAuth, markUrgent);\n\n// POST /api/reception/queue/:id/move-back -> move waiting token 3 positions back');

fs.writeFileSync(routesPath, routesContent);
console.log('Routes updated.');
