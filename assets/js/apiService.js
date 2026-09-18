/**
 * Hospital Management System (HMS) - API Service Facade
 * 
 * NOTE FOR FUTURE PHP BACKEND:
 * All UI components interact EXCLUSIVELY with this HMSApi service.
 * Currently, each method queries HMSDataStore (localStorage).
 * When integrating PHP & MySQL, simply replace the internal implementation 
 * of these methods with standard fetch() calls to your PHP scripts:
 * e.g., fetch('/api/patients/create.php', { method: 'POST', body: JSON.stringify(data) })
 */

const HMSApi = (function () {
  // Helper to simulate asynchronous network latency for realistic feel
  const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

  return {
    // ================= PATIENTS =================
    patients: {
      async getAll() {
        await delay(30);
        const basePatients = HMSDataStore.getCollection('patients');

        let extraPatients = [];
        try {
          const raw = localStorage.getItem('HMS_REGISTERED_PATIENTS_LIST');
          if (raw) extraPatients = JSON.parse(raw);
        } catch (e) {}

        // Include current patient user if active
        try {
          const u = (typeof HMSAuth !== 'undefined') ? HMSAuth.getCurrentUser() : null;
          if (u && (u.role === 'Patient' || u.roleKey === 'Patient') && u.id) {
            if (!extraPatients.some(p => p.id === u.id) && !basePatients.some(p => p.id === u.id)) {
              extraPatients.unshift({
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '+91 98765 00000',
                age: 26,
                dob: '2000-01-01',
                gender: 'General',
                bloodGroup: 'B+',
                status: 'Active',
                registeredDate: new Date().toISOString().split('T')[0]
              });
            }
          }
        } catch (e) {}

        // Combine extra (registered) patients first, then base patients, deduplicating by ID or email
        const combined = [...extraPatients, ...basePatients];
        const seen = new Set();
        return combined.filter(p => {
          const key = (p.id || p.email || p.name || '').toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      },

      async getById(id) {
        await delay(20);
        const all = await this.getAll();
        return all.find(p => String(p.id).toLowerCase() === String(id).toLowerCase()) || null;
      },

      async create(patientData) {
        await delay(80);
        const patients = HMSDataStore.getCollection('patients');
        const nextNum = (patients.length + 1).toString().padStart(3, '0');
        const newPatient = {
          id: patientData.id || `PAT-2026-${nextNum}`,
          name: patientData.name || '',
          age: Number(patientData.age) || 0,
          dob: patientData.dob || '',
          gender: patientData.gender || 'Other',
          phone: patientData.phone || '',
          email: patientData.email || '',
          address: patientData.address || '',
          bloodGroup: patientData.bloodGroup || 'Unknown',
          emergencyContact: patientData.emergencyContact || '',
          medicalHistory: patientData.medicalHistory || 'None noted.',
          status: 'Active',
          registeredDate: new Date().toISOString().split('T')[0]
        };
        HMSDataStore.addItem('patients', newPatient);
        return newPatient;
      },

      async update(id, updatedData) {
        await delay(80);
        return HMSDataStore.updateItem('patients', 'id', id, updatedData);
      },

      async delete(id) {
        await delay(50);
        return HMSDataStore.deleteItem('patients', 'id', id);
      }
    },

    // ================= DOCTORS =================
    doctors: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('doctors');
      },

      async getById(id) {
        await delay(30);
        return HMSDataStore.findItem('doctors', 'id', id);
      },

      async create(doctorData) {
        await delay(80);
        const doctors = HMSDataStore.getCollection('doctors');
        const nextId = `DOC-${100 + doctors.length + 1}`;
        const newDoc = {
          id: nextId,
          name: doctorData.name,
          specialization: doctorData.specialization,
          qualification: doctorData.qualification || 'MBBS, MD',
          experience: doctorData.experience || '5 Years',
          phone: doctorData.phone || '',
          email: doctorData.email || '',
          room: doctorData.room || 'Consultation Suite 101',
          availability: doctorData.availability || 'Available',
          status: 'Active',
          schedule: doctorData.schedule || 'Mon - Fri: 09:00 AM - 03:00 PM',
          avatar: doctorData.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=256'
        };
        HMSDataStore.addItem('doctors', newDoc);
        return newDoc;
      },

      async update(id, updatedData) {
        await delay(60);
        return HMSDataStore.updateItem('doctors', 'id', id, updatedData);
      },

      async updateAvailability(id, status) {
        await delay(40);
        return HMSDataStore.updateItem('doctors', 'id', id, { availability: status });
      }
    },

    // ================= APPOINTMENTS =================
    appointments: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('appointments');
      },

      async getById(id) {
        await delay(30);
        return HMSDataStore.findItem('appointments', 'id', id);
      },

      async book(bookingData) {
        await delay(100);
        const appointments = HMSDataStore.getCollection('appointments');
        const nextNum = (appointments.length + 101).toString();
        const newAppointment = {
          id: `APT-2026-${nextNum}`,
          patientId: bookingData.patientId,
          patientName: bookingData.patientName,
          doctorId: bookingData.doctorId,
          doctorName: bookingData.doctorName,
          department: bookingData.department || 'General Medicine',
          date: bookingData.date,
          time: bookingData.time,
          reason: bookingData.reason || 'General Consultation',
          status: 'Confirmed',
          checkInTime: null
        };
        HMSDataStore.addItem('appointments', newAppointment);

        // Also add to waiting room queue if today
        const todayStr = new Date().toISOString().split('T')[0];
        if (bookingData.date === todayStr) {
          HMSDataStore.addItem('waitingQueue', {
            id: `WQ-${Date.now().toString().slice(-4)}`,
            patientName: newAppointment.patientName,
            patientId: newAppointment.patientId,
            doctorName: newAppointment.doctorName,
            department: newAppointment.department,
            appointmentTime: newAppointment.time,
            checkInTime: 'Pending',
            waitMinutes: 0,
            status: 'Waiting'
          });
        }

        return newAppointment;
      },

      async reschedule(id, newDate, newTime) {
        await delay(70);
        return HMSDataStore.updateItem('appointments', 'id', id, {
          date: newDate,
          time: newTime,
          status: 'Confirmed'
        });
      },

      async updateStatus(id, newStatus) {
        await delay(50);
        const apt = HMSDataStore.updateItem('appointments', 'id', id, { status: newStatus });
        return apt;
      },

      async cancel(id) {
        await delay(50);
        return HMSDataStore.updateItem('appointments', 'id', id, { status: 'Cancelled' });
      }
    },

    // ================= CONSULTATIONS =================
    consultations: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('consultations');
      },

      async getByPatientId(patientId) {
        await delay(40);
        const all = HMSDataStore.getCollection('consultations');
        return all.filter(c => c.patientId === patientId);
      },

      async save(consultationData) {
        await delay(100);
        const consultations = HMSDataStore.getCollection('consultations');
        const nextId = `CON-2026-${(consultations.length + 1).toString().padStart(3, '0')}`;
        const newRecord = {
          id: nextId,
          patientId: consultationData.patientId,
          patientName: consultationData.patientName,
          doctorId: consultationData.doctorId,
          doctorName: consultationData.doctorName,
          date: new Date().toISOString().split('T')[0],
          symptoms: consultationData.symptoms,
          diagnosis: consultationData.diagnosis,
          notes: consultationData.notes,
          tests: consultationData.tests || [],
          prescriptions: consultationData.prescriptions || []
        };
        HMSDataStore.addItem('consultations', newRecord);

        // Update appointment status to completed if provided
        if (consultationData.appointmentId) {
          HMSDataStore.updateItem('appointments', 'id', consultationData.appointmentId, { status: 'Completed' });
        }

        // Auto-generate invoice if billing breakdown included
        if (consultationData.generateBill) {
          const bills = HMSDataStore.getCollection('bills');
          const billNum = (bills.length + 882).toString();
          const consultFee = Number(consultationData.consultationFee || 100.00);
          const testCharges = (newRecord.tests.length * 75.00);
          const medCharges = (newRecord.prescriptions.length * 20.00);
          HMSDataStore.addItem('bills', {
            billId: `INV-2026-${billNum}`,
            patientId: newRecord.patientId,
            patientName: newRecord.patientName,
            date: newRecord.date,
            doctorName: newRecord.doctorName,
            consultationFee: consultFee,
            testCharges: testCharges,
            medicineCharges: medCharges,
            otherCharges: 10.00,
            totalAmount: consultFee + testCharges + medCharges + 10.00,
            paymentStatus: 'Pending',
            paymentMethod: 'Cash / Card'
          });
        }

        return newRecord;
      }
    },

    // ================= BILLING =================
    bills: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('bills');
      },

      async getById(billId) {
        await delay(30);
        return HMSDataStore.findItem('bills', 'billId', billId);
      },

      async markPaid(billId, paymentMethod = 'Cash') {
        await delay(60);
        return HMSDataStore.updateItem('bills', 'billId', billId, {
          paymentStatus: 'Paid',
          paymentMethod: paymentMethod
        });
      },

      async create(billData) {
        await delay(80);
        const bills = HMSDataStore.getCollection('bills');
        const billNum = (bills.length + 882).toString();
        const newBill = {
          billId: `INV-2026-${billNum}`,
          patientId: billData.patientId,
          patientName: billData.patientName,
          date: billData.date || new Date().toISOString().split('T')[0],
          doctorName: billData.doctorName || 'Attending Physician',
          consultationFee: Number(billData.consultationFee) || 0,
          testCharges: Number(billData.testCharges) || 0,
          medicineCharges: Number(billData.medicineCharges) || 0,
          otherCharges: Number(billData.otherCharges) || 0,
          totalAmount: Number(billData.totalAmount) || 0,
          paymentStatus: billData.paymentStatus || 'Pending',
          paymentMethod: billData.paymentMethod || 'Pending'
        };
        HMSDataStore.addItem('bills', newBill);
        return newBill;
      }
    },

    // ================= RATINGS & REVIEWS =================
    ratings: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('ratings');
      },

      async submit(reviewData) {
        await delay(80);
        const reviews = HMSDataStore.getCollection('ratings');
        const newReview = {
          id: `REV-${100 + reviews.length + 1}`,
          patientName: reviewData.patientName || 'Anonymous Patient',
          doctorId: reviewData.doctorId,
          doctorName: reviewData.doctorName,
          department: reviewData.department || 'General Care',
          rating: Number(reviewData.rating) || 5,
          comment: reviewData.comment || '',
          date: new Date().toISOString().split('T')[0],
          verified: true
        };
        HMSDataStore.addItem('ratings', newReview);
        return newReview;
      }
    },

    // ================= HEALTH CHECKUPS =================
    healthCheckups: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('healthCheckups');
      },

      async add(checkupData) {
        await delay(80);
        const checkups = HMSDataStore.getCollection('healthCheckups');
        const nextId = `CHK-2026-${(checkups.length + 1).toString().padStart(2, '0')}`;
        const item = {
          id: nextId,
          ...checkupData,
          date: checkupData.date || new Date().toISOString().split('T')[0]
        };
        HMSDataStore.addItem('healthCheckups', item);
        return item;
      }
    },

    // ================= DISCHARGE SUMMARIES =================
    dischargeSummaries: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('dischargeSummaries');
      },

      async getById(id) {
        await delay(30);
        return HMSDataStore.findItem('dischargeSummaries', 'id', id);
      },

      async create(data) {
        await delay(90);
        const list = HMSDataStore.getCollection('dischargeSummaries');
        const nextId = `DS-2026-${(list.length + 43).toString().padStart(3, '0')}`;
        const newSummary = {
          id: nextId,
          patientId: data.patientId,
          patientName: data.patientName,
          age: data.age,
          gender: data.gender,
          admissionDate: data.admissionDate,
          dischargeDate: data.dischargeDate || new Date().toISOString().split('T')[0],
          doctor: data.doctor,
          diagnosis: data.diagnosis,
          treatment: data.treatment,
          conditionAtDischarge: data.conditionAtDischarge || 'Stable',
          medicines: Array.isArray(data.medicines) ? data.medicines : [data.medicines],
          testsPerformed: data.testsPerformed || 'Routine Panels',
          doctorNotes: data.doctorNotes || '',
          followUpInstructions: data.followUpInstructions || ''
        };
        HMSDataStore.addItem('dischargeSummaries', newSummary);
        return newSummary;
      }
    },

    // ================= DOCUMENTS =================
    documents: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('documents');
      },

      async upload(docData) {
        await delay(90);
        const docs = HMSDataStore.getCollection('documents');
        const nextId = `DOC-FILE-${(docs.length + 1).toString().padStart(3, '0')}`;
        const newDoc = {
          id: nextId,
          name: docData.name || 'Document_File.pdf',
          category: docData.category || 'General Documents',
          uploadedDate: new Date().toISOString().split('T')[0],
          uploadedBy: docData.uploadedBy || 'Admin',
          fileType: docData.fileType || 'PDF',
          fileSize: docData.fileSize || '1.2 MB',
          status: 'Verified'
        };
        HMSDataStore.addItem('documents', newDoc);
        return newDoc;
      },

      async delete(id) {
        await delay(50);
        return HMSDataStore.deleteItem('documents', 'id', id);
      }
    },

    // ================= WAITING ROOM QUEUE =================
    waitingQueue: {
      async getAll() {
        await delay(40);
        return HMSDataStore.getCollection('waitingQueue');
      },

      async updateStatus(id, newStatus) {
        await delay(50);
        return HMSDataStore.updateItem('waitingQueue', 'id', id, { status: newStatus });
      }
    },

    // ================= ASSETS =================
    assets: {
      async getAll() {
        await delay(50);
        return HMSDataStore.getCollection('assets');
      },

      async create(assetData) {
        await delay(80);
        const assets = HMSDataStore.getCollection('assets');
        const nextId = `AST-${(assets.length + 1).toString().padStart(2, '0')}`;
        const newAsset = {
          id: nextId,
          assetId: assetData.assetId || `EQ-${Date.now().toString().slice(-4)}`,
          name: assetData.name,
          category: assetData.category || 'Biomedical',
          location: assetData.location || 'General Ward',
          status: assetData.status || 'Working',
          purchaseDate: assetData.purchaseDate || new Date().toISOString().split('T')[0],
          maintenanceDate: assetData.maintenanceDate || 'Scheduled',
          cost: assetData.cost || '$0.00'
        };
        HMSDataStore.addItem('assets', newAsset);
        return newAsset;
      },

      async update(id, updatedData) {
        await delay(60);
        return HMSDataStore.updateItem('assets', 'id', id, updatedData);
      },

      async delete(id) {
        await delay(50);
        return HMSDataStore.deleteItem('assets', 'id', id);
      }
    },

    // ================= DOCUMENTS =================
    documents: {
      async getAll() {
        await delay(50);
        let docs = HMSDataStore.getCollection('documents');
        if (!docs || docs.length === 0) {
          docs = [
            {
              id: 'DOC-1001',
              name: 'Complete Blood Count (CBC) - Sneha R.pdf',
              category: 'Medical Reports',
              uploadedDate: new Date().toISOString().split('T')[0],
              uploadedBy: 'Central Diagnostic Lab / Super Admin',
              fileType: 'PDF',
              fileSize: '245 KB',
              status: 'Verified',
              patientName: 'Sneha R',
              patientId: 'H1268',
              details: {
                hb: '13.4 g/dL',
                wbc: '7,800 /mcL',
                platelets: '2.6 Lakhs /mcL',
                remarks: 'Normal peripheral smear findings. No toxic granules seen.'
              }
            },
            {
              id: 'DOC-1002',
              name: 'HbA1c & Fasting Glucose - David Chen.pdf',
              category: 'Medical Reports',
              uploadedDate: new Date().toISOString().split('T')[0],
              uploadedBy: 'Central Diagnostic Lab',
              fileType: 'PDF',
              fileSize: '180 KB',
              status: 'Verified',
              patientName: 'David Chen',
              patientId: 'PAT-2026-003'
            },
            {
              id: 'DOC-1003',
              name: 'Brain MRI Scan Series 3 - Rahul K.pdf',
              category: 'Medical Reports',
              uploadedDate: new Date().toISOString().split('T')[0],
              uploadedBy: 'Radiology Dept',
              fileType: 'PDF',
              fileSize: '4.2 MB',
              status: 'Verified',
              patientName: 'Rahul K',
              patientId: 'H1042'
            },
            {
              id: 'DOC-1004',
              name: 'Inpatient Health Insurance Claim Form.pdf',
              category: 'Patient Documents',
              uploadedDate: new Date().toISOString().split('T')[0],
              uploadedBy: 'Admissions Desk',
              fileType: 'PDF',
              fileSize: '512 KB',
              status: 'Approved',
              patientName: 'Sneha R',
              patientId: 'H1268'
            }
          ];
          HMSDataStore.saveCollection('documents', docs);
        }
        return docs;
      },

      async upload(docData) {
        await delay(80);
        const docs = HMSDataStore.getCollection('documents');
        const nextId = `DOC-${1000 + docs.length + 1}`;
        const newDoc = {
          id: docData.id || nextId,
          name: docData.name || 'Diagnostic_Report.pdf',
          category: docData.category || 'Medical Reports',
          uploadedDate: docData.uploadedDate || new Date().toISOString().split('T')[0],
          uploadedBy: docData.uploadedBy || 'Central Diagnostic Lab',
          fileType: docData.fileType || 'PDF',
          fileSize: docData.fileSize || '245 KB',
          status: docData.status || 'Verified',
          patientName: docData.patientName || '',
          patientId: docData.patientId || '',
          details: docData.details || null
        };
        HMSDataStore.addItem('documents', newDoc);
        return newDoc;
      },

      async delete(id) {
        await delay(50);
        return HMSDataStore.deleteItem('documents', 'id', id);
      }
    },

    // ================= STATS & SUMMARY METRICS =================
    stats: {
      async getOverview() {
        await delay(60);
        const patients = HMSDataStore.getCollection('patients');
        const doctors = HMSDataStore.getCollection('doctors');
        const appointments = HMSDataStore.getCollection('appointments');
        const bills = HMSDataStore.getCollection('bills');
        const queue = HMSDataStore.getCollection('waitingQueue');

        const pendingBills = bills.filter(b => b.paymentStatus === 'Pending');
        const pendingAmount = pendingBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);

        const todayStr = new Date().toISOString().split('T')[0];
        const todayAppts = appointments.filter(a => a.date === todayStr);

        return {
          totalPatients: patients.length,
          totalDoctors: doctors.length,
          activeDoctors: doctors.filter(d => d.availability === 'Available').length,
          todayAppointments: todayAppts.length,
          totalAppointments: appointments.length,
          pendingBillsCount: pendingBills.length,
          pendingBillsAmount: pendingAmount,
          waitingCount: queue.filter(q => q.status === 'Waiting').length
        };
      }
    }
  };
})();

if (typeof window !== 'undefined') {
  window.HMSApi = HMSApi;
}
