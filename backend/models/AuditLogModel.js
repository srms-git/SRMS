const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  action: {
    type: String,
    required: true,
    uppercase: true // e.g., 'UPDATE_ESTRUS_LOG', 'AUTOMATED_CULLING'
  },
  entityType: {
    type: String,
    required: true,
    lowercase: true // e.g., 'sows', 'reproduction_records'
  },
  entityId: {
    type: String,
    default: null
  },
  oldValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false } // Only track creation time
});

// Indexing for rapid queries on specific records or actions
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);