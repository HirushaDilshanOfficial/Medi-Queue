const mongoose = require('mongoose');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const toMinutes = (timeStr) => {
  if (typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      trim: true,
      validate: {
        validator: function (value) {
          if (!dateRegex.test(value)) return false;
          const d = new Date(`${value}T00:00:00.000Z`);
          return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
        },
        message: 'Date must be a valid date in YYYY-MM-DD format',
      },
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
      validate: {
        validator: function (value) {
          return timeRegex.test(value);
        },
        message: 'Start time must be in HH:mm 24-hour format (e.g. 08:30)',
      },
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
      validate: [
        {
          validator: function (value) {
            return timeRegex.test(value);
          },
          message: 'End time must be in HH:mm 24-hour format (e.g. 16:30)',
        },
        {
          validator: function (value) {
            const start = this.startTime || (this.getUpdate && (this.getUpdate().startTime || this.getUpdate().$set?.startTime));
            if (!start || !value) return true;
            const startMins = toMinutes(start);
            const endMins = toMinutes(value);
            if (startMins === null || endMins === null) return false;
            return endMins > startMins;
          },
          message: 'End time must be after start time',
        },
      ],
    },
    slotMinutes: {
      type: Number,
      default: 15,
      min: [1, 'Slot duration must be at least 1 minute'],
    },
    maxPatients: {
      type: Number,
      default: 30,
      min: [1, 'Max patients must be at least 1'],
    },
    status: {
      type: String,
      enum: {
        values: ['available', 'leave'],
        message: '{VALUE} is not a valid status (must be available or leave)',
      },
      default: 'available',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to guarantee end time > start time
doctorScheduleSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime) {
    const startMins = toMinutes(this.startTime);
    const endMins = toMinutes(this.endTime);
    if (startMins !== null && endMins !== null && endMins <= startMins) {
      this.invalidate('endTime', 'End time must be after start time');
    }
  }
  next();
});

// Unique compound index on (doctor, date, startTime)
doctorScheduleSchema.index({ doctor: 1, date: 1, startTime: 1 }, { unique: true });

const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);

module.exports = DoctorSchedule;
