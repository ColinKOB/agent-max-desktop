import { useEffect, useState } from 'react';
import { Settings, Trash2, Edit2, Check, X, Plus } from 'lucide-react';
import useStore from '../store/useStore';
import { preferencesAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Preferences() {
  const { preferences, setPreferences, setLoading } = useStore();
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const res = await preferencesAPI.getPreferences();
      setPreferences(res.data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (key, value) => {
    setEditingKey(key);
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value));
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) {
      toast.error('Value cannot be empty');
      return;
    }

    try {
      let parsedValue = editValue;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // Keep as string if not valid JSON
      }

      await preferencesAPI.setPreference(editingKey, parsedValue);
      setEditingKey(null);
      setEditValue('');
      await loadPreferences();
      toast.success('Preference updated');
    } catch (error) {
      console.error('Failed to update preference:', error);
      toast.error('Failed to update preference');
    }
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Delete preference "${key}"?`)) {
      return;
    }

    try {
      await preferencesAPI.deletePreference(key);
      await loadPreferences();
      toast.success('Preference deleted');
    } catch (error) {
      console.error('Failed to delete preference:', error);
      toast.error('Failed to delete preference');
    }
  };

  const handleAddPreference = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Both key and value are required');
      return;
    }

    try {
      let parsedValue = newValue;
      try {
        parsedValue = JSON.parse(newValue);
      } catch {
        // Keep as string if not valid JSON
      }

      await preferencesAPI.setPreference(newKey, parsedValue);
      setIsAdding(false);
      setNewKey('');
      setNewValue('');
      await loadPreferences();
      toast.success('Preference added');
    } catch (error) {
      console.error('Failed to add preference:', error);
      toast.error('Failed to add preference');
    }
  };

  const explicitPrefs = preferences.explicit || {};
  const implicitPrefs = preferences.implicit || {};

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Preferences
        </h1>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Preference</span>
          </button>
        )}
      </div>

      {/* Add Preference Form */}
      {isAdding && (
        <div className="card mb-8 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Add New Preference
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key (e.g., theme)"
              className="input w-full"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder='Value (e.g., "dark" or {"mode": "dark"})'
              className="input w-full"
            />
            <div className="flex space-x-2">
              <button onClick={handleAddPreference} className="btn-primary flex-1">
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewKey('');
                  setNewValue('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Preferences */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Explicit Preferences
          </h2>
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
            {Object.keys(explicitPrefs).length}
          </span>
        </div>

        {Object.keys(explicitPrefs).length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No explicit preferences set
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(explicitPrefs).map(([key, value]) => (
              <PreferenceCard
                key={key}
                prefKey={key}
                value={value}
                isEditing={editingKey === key}
                editValue={editValue}
                onEditValueChange={setEditValue}
                onStartEdit={() => handleStartEdit(key, value)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => {
                  setEditingKey(null);
                  setEditValue('');
                }}
                onDelete={() => handleDelete(key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Implicit Preferences */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Implicit Preferences
          </h2>
          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
            {Object.keys(implicitPrefs).length}
          </span>
        </div>

        {Object.keys(implicitPrefs).length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No implicit preferences detected yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              These are learned from your interactions over time
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(implicitPrefs).map(([key, data]) => (
              <ImplicitPreferenceCard
                key={key}
                prefKey={key}
                data={data}
                onDelete={() => handleDelete(key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreferenceCard({
  prefKey,
  value,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}) {
  const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

  return (
    <div className="card bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {prefKey}
          </p>
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                className="input w-full font-mono text-sm"
                rows={3}
                autoFocus
              />
              <div className="flex space-x-2">
                <button onClick={onSaveEdit} className="btn-primary text-sm">
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </button>
                <button onClick={onCancelEdit} className="btn-secondary text-sm">
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <pre className="mt-1 text-gray-900 dark:text-gray-100 text-sm whitespace-pre-wrap font-mono">
              {displayValue}
            </pre>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={onStartEdit}
              className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImplicitPreferenceCard({ prefKey, data, onDelete }) {
  const confidence = data.confidence || 0;
  const value = data.value || data;

  return (
    <div className="card bg-purple-50 dark:bg-purple-900/20">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {prefKey}
            </p>
            <span className="px-2 py-0.5 bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded">
              {(confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="text-gray-900 dark:text-gray-100">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </p>
          
          <div className="mt-2">
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 ml-4"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
