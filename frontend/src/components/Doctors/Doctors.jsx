import { useCallback, useEffect, useState } from 'react';
import { searchDoctorDirectory } from '../../api';
import DoctorCard from '../theDoctors/DoctorCard';
import './Doctors.css';

const initialFilters = { name: '', specialty: '', hospital: '', location: '', city: '', mode: '', availableAt: '', sort: 'name' };

export default function Doctors() {
  const [filters, setFilters] = useState(initialFilters);
  const [doctors, setDoctors] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = useCallback(async (nextPage, nextFilters) => {
    setLoading(true); setError('');
    const params = { ...nextFilters, page: nextPage, limit: 12 };
    if (params.availableAt) params.availableAt = `${params.availableAt}:00Z`;
    Object.keys(params).forEach((key) => { if (params[key] === '') delete params[key]; });
    try {
      const result = await searchDoctorDirectory(params);
      setDoctors(result.doctors || []); setPage(result.page || nextPage); setPages(result.pages || 1); setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Doctor profiles are temporarily unavailable. Please try again.');
      setDoctors([]); setTotal(0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { search(1, initialFilters); }, [search]);

  function update(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function reset() { setFilters(initialFilters); search(1, initialFilters); }
  function submit(event) { event.preventDefault(); search(1, filters); }

  return (
    <section className="doctors-page">
      <div className="doctor-section"><div className="container">
        <p className="eyebrow">CARE THAT FITS YOUR NEEDS</p><h1 className="heading">Find your doctor</h1>
        <p className="page-intro">Search doctor profiles by name, specialty, practice, location, or an open appointment time.</p>
        <form className="doctor-filter-panel" onSubmit={submit} role="search" aria-label="Filter doctors">
          <div className="doctor-filters">
            <label>Doctor name<input name="name" value={filters.name} onChange={update} placeholder="e.g. Alex Morgan" /></label>
            <label>Specialty<input name="specialty" value={filters.specialty} onChange={update} placeholder="e.g. Cardiology" /></label>
            <label>Hospital or clinic<input name="hospital" value={filters.hospital} onChange={update} placeholder="Practice name" /></label>
            <label>City or location<input name="location" value={filters.location} onChange={update} placeholder="City, area, postal code" /></label>
            <label>Consultation mode<select name="mode" value={filters.mode} onChange={update}><option value="">Any mode</option><option value="in-person">In person</option><option value="online">Online</option></select></label>
            <label>Open at (UTC)<input name="availableAt" type="datetime-local" value={filters.availableAt} onChange={update} /></label>
            <label>Sort by<select name="sort" value={filters.sort} onChange={update}><option value="name">Name</option><option value="experience">Experience</option><option value="rating">Patient rating</option></select></label>
          </div>
          <div className="doctor-filter-actions"><button type="submit" className="search-button" disabled={loading}>{loading ? 'Searching…' : 'Search doctors'}</button><button type="button" className="btn-secondary clear-search" onClick={reset} disabled={loading}>Reset filters</button></div>
        </form>
      </div></div>
      <div className="container doctor-results" aria-live="polite">
        <div className="results-heading"><h2>Doctor directory</h2>{!loading && <span>{total} {total === 1 ? 'doctor' : 'doctors'}</span>}</div>
        {loading && <p className="empty-state" role="status">Loading doctor profiles…</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {!loading && !error && doctors.length > 0 && <><div className="doctor-list">{doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} />)}</div>
          {pages > 1 && <nav className="pagination" aria-label="Doctor search pages"><button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => search(page - 1, filters)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="btn-secondary" disabled={page >= pages || loading} onClick={() => search(page + 1, filters)}>Next</button></nav>}
        </>}
        {!loading && !error && doctors.length === 0 && <p className="empty-state">No doctors match those filters. Try broadening your search.</p>}
      </div>
    </section>
  );
}
