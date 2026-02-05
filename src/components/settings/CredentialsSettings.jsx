/**
 * CredentialsSettings
 *
 * UI for managing usernames and passwords that the AI can use
 * in its isolated workspace for research and browsing tasks.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import credentialsManager from '../../services/credentialsManager';

const FIGTREE = 'Figtree, system-ui, -apple-system, sans-serif';

// Common services with icons
const COMMON_SERVICES = [
  { value: 'google.com', label: 'Google', icon: 'G' },
  { value: 'github.com', label: 'GitHub', icon: 'GH' },
  { value: 'linkedin.com', label: 'LinkedIn', icon: 'in' },
  { value: 'twitter.com', label: 'X (Twitter)', icon: 'X' },
  { value: 'facebook.com', label: 'Facebook', icon: 'f' },
  { value: 'amazon.com', label: 'Amazon', icon: 'A' },
  { value: 'microsoft.com', label: 'Microsoft', icon: 'M' },
  { value: 'apple.com', label: 'Apple', icon: '' },
  { value: 'custom', label: 'Custom...', icon: '+' },
];

// Styles
const styles = {
  section: {
    border: '1px solid rgba(255,255,255,0.14)',
    borderLeft: '2px solid #e8853b',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: 20,
    marginBottom: 24
  },
  heading: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    color: 'rgba(255,255,255,0.95)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: FIGTREE,
  },
  subheading: {
    fontSize: 13,
    color: 'rgba(168,152,130,0.8)',
    marginBottom: 16
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  inputFocus: {
    borderColor: 'rgba(232, 133, 59, 0.5)'
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: 'rgba(168,152,130,0.9)',
    marginBottom: 6
  },
  button: {
    background: 'rgba(232, 133, 59, 0.3)',
    color: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(232, 133, 59, 0.5)',
    borderRadius: 4,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  buttonSecondary: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  buttonDanger: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: 'rgb(252, 165, 165)'
  },
  credentialCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'transform 0.15s ease, border-color 0.15s ease',
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: 'rgba(232, 133, 59, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: '#e8853b',
    marginRight: 12
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: 'rgba(26,26,31,0.98)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
  }
};

export default function CredentialsSettings() {
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [showPassword, setShowPassword] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    service: '',
    customService: '',
    username: '',
    password: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      const creds = await credentialsManager.getCredentialsSummary();
      setCredentials(creds);
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      service: '',
      customService: '',
      username: '',
      password: '',
      notes: ''
    });
    setFormError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingCredential(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = async (id) => {
    try {
      const cred = await credentialsManager.getCredentialDecrypted(id);
      if (cred) {
        const isCustom = !COMMON_SERVICES.find(s => s.value === cred.service);
        setFormData({
          name: cred.name,
          service: isCustom ? 'custom' : cred.service,
          customService: isCustom ? cred.service : '',
          username: cred.username,
          password: cred.password,
          notes: cred.notes || ''
        });
        setEditingCredential(id);
        setShowAddModal(true);
      }
    } catch (error) {
      console.error('Failed to load credential for editing:', error);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingCredential(null);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const service = formData.service === 'custom' ? formData.customService : formData.service;

    if (!formData.name.trim()) {
      setFormError('Please enter a name for this credential');
      return;
    }
    if (!service.trim()) {
      setFormError('Please select or enter a service');
      return;
    }
    if (!formData.username.trim()) {
      setFormError('Please enter a username or email');
      return;
    }
    if (!formData.password.trim()) {
      setFormError('Please enter a password');
      return;
    }

    try {
      if (editingCredential) {
        await credentialsManager.updateCredential(editingCredential, {
          name: formData.name.trim(),
          service: service.trim(),
          username: formData.username.trim(),
          password: formData.password,
          notes: formData.notes.trim()
        });
      } else {
        await credentialsManager.addCredential({
          name: formData.name.trim(),
          service: service.trim(),
          username: formData.username.trim(),
          password: formData.password,
          notes: formData.notes.trim()
        });
      }

      await loadCredentials();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save credential:', error);
      setFormError('Failed to save credential. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this credential? This cannot be undone.')) {
      return;
    }

    try {
      await credentialsManager.deleteCredential(id);
      await loadCredentials();
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  const getServiceIcon = (service) => {
    const found = COMMON_SERVICES.find(s => service.includes(s.value.split('.')[0]));
    return found?.icon || service.charAt(0).toUpperCase();
  };

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        AI Workspace Credentials
      </h2>
      <p style={styles.subheading}>
        Store login credentials for websites the AI can access in its isolated workspace.
        Credentials are encrypted and only used for research and browsing tasks.
      </p>

      {/* Credentials List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)' }}>
          Loading...
        </div>
      ) : credentials.length === 0 ? (
        <div style={{
          padding: '20px 16px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 4,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>
            No credentials saved yet. Add one so Max can log into websites during research.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {credentials.map((cred) => (
            <div key={cred.id} style={styles.credentialCard}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={styles.serviceIcon}>
                  {getServiceIcon(cred.service)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                    {cred.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {cred.service}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleOpenEdit(cred.id)}
                  style={{ ...styles.button, ...styles.buttonSecondary, padding: '6px 12px', fontSize: 12 }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cred.id)}
                  style={{ ...styles.button, ...styles.buttonDanger, padding: '6px 12px', fontSize: 12 }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <button onClick={handleOpenAdd} style={styles.button}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Credential
      </button>

      {/* Add/Edit Modal */}
      <AnimatePresence>
      {showAddModal && (
        <div style={styles.modal} onClick={handleCloseModal}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'rgba(255,255,255,0.95)', fontFamily: FIGTREE }}>
              {editingCredential ? 'Edit Credential' : 'Add New Credential'}
            </h3>

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Display Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Work Google Account"
                  style={styles.input}
                />
              </div>

              {/* Service */}
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Service / Website</label>
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  style={{ ...styles.input, cursor: 'pointer' }}
                >
                  <option value="">Select a service...</option>
                  {COMMON_SERVICES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom Service */}
              {formData.service === 'custom' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={styles.label}>Custom Service URL</label>
                  <input
                    type="text"
                    value={formData.customService}
                    onChange={(e) => setFormData({ ...formData, customService: e.target.value })}
                    placeholder="e.g., mycompany.com"
                    style={styles.input}
                  />
                </div>
              )}

              {/* Username */}
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Username or Email</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="your@email.com"
                  autoComplete="off"
                  style={styles.input}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword.form ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{ ...styles.input, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword({ ...showPassword, form: !showPassword.form })}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      padding: 4
                    }}
                  >
                    {showPassword.form ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <label style={styles.label}>Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes about this account..."
                  rows={3}
                  style={{ ...styles.input, resize: 'vertical' }}
                />
              </div>

              {/* Error */}
              {formError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 16,
                  color: 'rgb(252, 165, 165)',
                  fontSize: 13
                }}>
                  {formError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.button}>
                  {editingCredential ? 'Save Changes' : 'Add Credential'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Security Notice */}
      <div style={{
        marginTop: 16,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderLeft: '2px solid rgba(251, 191, 36, 0.5)',
        borderRadius: 0,
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        lineHeight: 1.5,
      }}>
        <strong style={{ color: 'rgba(251, 191, 36, 0.8)' }}>Security:</strong> Credentials are encrypted locally and only used in the isolated workspace. Consider app-specific passwords where available.
      </div>
    </section>
  );
}
