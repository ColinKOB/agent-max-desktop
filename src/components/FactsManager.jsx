import { useState } from 'react';
import { Edit2, Trash2, Plus, X, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

export default function FactsManager({ facts, onEdit, onDelete, onAdd, selectedCategory }) {
  const [editingFact, setEditingFact] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleStartEdit = (category, key, value) => {
    setEditingFact({ category, key });
    setEditValue(value);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) {
      toast.error('Value cannot be empty');
      return;
    }

    try {
      await onEdit(editingFact.category, editingFact.key, editValue);
      setEditingFact(null);
      setEditValue('');
      toast.success('Fact updated');
    } catch (error) {
      toast.error('Failed to update fact');
    }
  };

  const handleCancelEdit = () => {
    setEditingFact(null);
    setEditValue('');
  };

  const handleDelete = async (category, key) => {
    if (window.confirm('Are you sure you want to delete this fact?')) {
      try {
        await onDelete(category, key);
        toast.success('Fact deleted');
      } catch (error) {
        toast.error('Failed to delete fact');
      }
    }
  };

  const handleAddFact = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Both key and value are required');
      return;
    }

    try {
      await onAdd(selectedCategory || 'personal', newKey, newValue);
      setIsAdding(false);
      setNewKey('');
      setNewValue('');
      toast.success('Fact added');
    } catch (error) {
      toast.error('Failed to add fact');
    }
  };

  const factEntries = selectedCategory
    ? Object.entries(facts[selectedCategory] || {})
    : Object.entries(facts).flatMap(([category, items]) =>
        Object.entries(items).map(([key, value]) => ({ category, key, value }))
      );

  return (
    <div className="space-y-4">
      {/* Add Fact Button */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Fact</span>
        </button>
      ) : (
        <div className="card bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Add New Fact
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key (e.g., favorite_color)"
              className="input w-full"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              className="input w-full"
            />
            <div className="flex space-x-2">
              <button onClick={handleAddFact} className="btn-primary flex-1">
                <Check className="w-4 h-4 mr-2" />
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
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Facts List */}
      {selectedCategory ? (
        <div className="space-y-2">
          {Object.entries(facts[selectedCategory] || {}).map(([key, value]) => (
            <FactCard
              key={key}
              category={selectedCategory}
              factKey={key}
              value={value}
              isEditing={editingFact?.category === selectedCategory && editingFact?.key === key}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEdit={() => handleStartEdit(selectedCategory, key, value)}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDelete={() => handleDelete(selectedCategory, key)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(facts).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 capitalize">
                {category}
              </h3>
              <div className="space-y-2">
                {Object.entries(items).map(([key, value]) => (
                  <FactCard
                    key={`${category}-${key}`}
                    category={category}
                    factKey={key}
                    value={value}
                    isEditing={editingFact?.category === category && editingFact?.key === key}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    onStartEdit={() => handleStartEdit(category, key, value)}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onDelete={() => handleDelete(category, key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {factEntries.length === 0 && !isAdding && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No facts found. Add your first fact!
        </div>
      )}
    </div>
  );
}

function FactCard({
  category,
  factKey,
  value,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}) {
  return (
    <div className="card bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {factKey}
          </p>
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                className="input w-full"
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
            <p className="mt-1 text-gray-900 dark:text-gray-100">{value}</p>
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
