import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { downloadDocument, getDocuments, getMedicalHistory, getPatientAppointments, revokeDocumentShare, saveMedicalHistory, shareDocument, uploadDocument } from '../../../api';
import './MedicalRecords.css';

const categories = ['allergies', 'conditions', 'medications', 'surgeries'];
const emptyHistory = { allergies: [], conditions: [], medications: [], surgeries: [], notes: '' };

export default function MedicalRecords() {
  const { user } = useOutletContext();
  const [history, setHistory] = useState(emptyHistory);
  const [appointments, setAppointments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('other');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Loading your records…');
  const [busy, setBusy] = useState(false);
  const treatingDoctorIds = [...new Set(appointments.map((appointment) => String(appointment.doctorId)))];

  const refresh = useCallback(async () => {
    try {
      const [historyResponse, appointmentResponse, documentResponse] = await Promise.all([getMedicalHistory(), getPatientAppointments(user._id), getDocuments()]);
      setHistory({ ...emptyHistory, ...historyResponse.data });
      setAppointments(appointmentResponse.data);
      setDocuments(documentResponse.data);
      setMessage('');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load your records.');
    }
  }, [user._id]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleSave(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const value = { ...history };
      for (const field of categories) value[field] = String(history[field] || []).join('\n').split('\n').map((item) => item.trim()).filter(Boolean);
      await saveMedicalHistory(value);
      setMessage('Medical history saved.');
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to save medical history.'); }
    finally { setBusy(false); }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage('');
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    try {
      await uploadDocument(form, ({ loaded, total }) => setProgress(Math.round((loaded / total) * 100)));
      setFile(null);
      event.target.reset();
      await refresh();
      setMessage('Document uploaded privately.');
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to upload document.'); }
    finally { setBusy(false); setProgress(0); }
  }

  async function handleDownload(document) {
    try {
      const response = await downloadDocument(document.id);
      const link = window.URL.createObjectURL(response.data);
      const anchor = window.document.createElement('a');
      anchor.href = link;
      anchor.download = document.filename;
      anchor.click();
      window.URL.revokeObjectURL(link);
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to download this document.'); }
  }

  async function handleShare(documentId, doctorId) {
    try { await shareDocument(documentId, doctorId); await refresh(); setMessage('Document shared with the treating doctor.'); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to share this document.'); }
  }

  async function handleRevoke(documentId, doctorId) {
    if (!window.confirm('Revoke this doctor’s access to the document?')) return;
    try { await revokeDocumentShare(documentId, doctorId); await refresh(); setMessage('Document access revoked.'); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to revoke access.'); }
  }

  return (
    <section className="medical-records">
      <h2>Medical history and documents</h2>
      {message && <p role="status">{message}</p>}
      <form onSubmit={handleSave}>
        <h3>Your medical history</h3>
        {categories.map((field) => <label key={field}>{field[0].toUpperCase() + field.slice(1)} (one per line)
          <textarea rows="3" value={Array.isArray(history[field]) ? history[field].join('\n') : history[field]} onChange={(event) => setHistory({ ...history, [field]: event.target.value.split('\n') })} />
        </label>)}
        <label>Additional notes<textarea rows="4" maxLength="5000" value={history.notes || ''} onChange={(event) => setHistory({ ...history, notes: event.target.value })} /></label>
        <button className="btn" disabled={busy}>Save medical history</button>
      </form>

      <form onSubmit={handleUpload}>
        <h3>Private documents</h3>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="other">Other</option><option value="lab-report">Lab report</option><option value="prescription">Prescription</option><option value="certificate">Medical certificate</option><option value="imaging">Scan or imaging</option><option value="consultation">Consultation summary</option></select></label>
        <label>Choose a PDF, JPEG, or PNG file<input type="file" accept="application/pdf,image/jpeg,image/png" required onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        {progress > 0 && <progress value={progress} max="100" aria-label="Upload progress">{progress}%</progress>}
        <button className="btn" disabled={busy || !file}>Upload document</button>
        <ul>{documents.map((document) => <li key={document.id}>
          <strong>{document.filename}</strong> · {document.category} · {new Date(document.uploadedAt).toLocaleDateString()}
          <div className="record-actions">
            <button type="button" onClick={() => handleDownload(document)}>Download</button>
            {treatingDoctorIds.map((doctorId) => <button type="button" key={`${document.id}-${doctorId}`} onClick={() => handleShare(document.id, doctorId)}>Share with doctor {doctorId.slice(-6)}</button>)}
            {(document.shared || []).map((doctorId) => <button type="button" key={doctorId} onClick={() => handleRevoke(document.id, doctorId)}>Revoke doctor {doctorId.slice(-6)}</button>)}
          </div>
        </li>)}</ul>
      </form>
    </section>
  );
}
