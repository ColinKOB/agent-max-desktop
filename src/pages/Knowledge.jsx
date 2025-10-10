import { useEffect, useState } from 'react';
import { Search, FileText, Sparkles } from 'lucide-react';
import FactsManager from '../components/FactsManager';
import useStore from '../store/useStore';
import { factsAPI } from '../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['all', 'personal', 'technical', 'preferences', 'projects', 'goals', 'other'];

export default function Knowledge() {
  const { facts, setFacts, setLoading } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [extractText, setExtractText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    loadFacts();
  }, [selectedCategory]);

  const loadFacts = async () => {
    setLoading(true);
    try {
      const category = selectedCategory === 'all' ? null : selectedCategory;
      const res = await factsAPI.getFacts(category);
      setFacts(res.data.facts || {});
    } catch (error) {
      console.error('Failed to load facts:', error);
      toast.error('Failed to load facts');
    } finally {
      setLoading(false);
    }
  };

  const handleEditFact = async (category, key, value) => {
    await factsAPI.setFact(category, key, value);
    await loadFacts();
  };

  const handleDeleteFact = async (category, key) => {
    await factsAPI.deleteFact(category, key);
    await loadFacts();
  };

  const handleAddFact = async (category, key, value) => {
    await factsAPI.setFact(category, key, value);
    await loadFacts();
  };

  const handleExtractFacts = async () => {
    if (!extractText.trim()) {
      toast.error('Please enter some text to extract facts from');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await factsAPI.extractFacts(extractText);
      toast.success(`Extracted ${res.data.extracted_count || 0} facts`);
      setExtractText('');
      await loadFacts();
    } catch (error) {
      console.error('Failed to extract facts:', error);
      toast.error('Failed to extract facts');
    } finally {
      setIsExtracting(false);
    }
  };

  // Filter facts based on search
  const filteredFacts = {};
  Object.entries(facts).forEach(([category, items]) => {
    const filtered = {};
    Object.entries(items).forEach(([key, value]) => {
      const matchesSearch = 
        !searchQuery ||
        key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(value).toLowerCase().includes(searchQuery.toLowerCase());
      
      if (matchesSearch) {
        filtered[key] = value;
      }
    });
    
    if (Object.keys(filtered).length > 0) {
      filteredFacts[category] = filtered;
    }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        Knowledge Base
      </h1>

      {/* Extract Facts Section */}
      <div className="card mb-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Extract Facts from Text
          </h2>
        </div>
        <textarea
          value={extractText}
          onChange={(e) => setExtractText(e.target.value)}
          placeholder="Paste or type text here to automatically extract facts..."
          rows={4}
          className="input w-full mb-3"
        />
        <button
          onClick={handleExtractFacts}
          disabled={isExtracting || !extractText.trim()}
          className="btn-primary"
        >
          {isExtracting ? 'Extracting...' : 'Extract Facts'}
        </button>
      </div>

      {/* Categories and Search */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Category Pills */}
          <div className="flex-1 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search facts..."
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Facts Count */}
      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
        <FileText className="w-4 h-4" />
        <span>
          {Object.values(filteredFacts).reduce((sum, items) => sum + Object.keys(items).length, 0)} facts
          {selectedCategory !== 'all' && ` in ${selectedCategory}`}
        </span>
      </div>

      {/* Facts Manager */}
      <FactsManager
        facts={filteredFacts}
        onEdit={handleEditFact}
        onDelete={handleDeleteFact}
        onAdd={handleAddFact}
        selectedCategory={selectedCategory === 'all' ? null : selectedCategory}
      />
    </div>
  );
}
