import { useState, useEffect } from 'react';
import { Search as SearchIcon, TrendingUp, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import { semanticAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Search() {
  const [query, setQuery] = useState('');
  const [threshold, setThreshold] = useState(0.75);
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const [patternsRes, cacheRes] = await Promise.all([
        semanticAPI.getPatterns(),
        semanticAPI.getCacheStats(),
      ]);
      setPatterns(patternsRes.data);
      setCacheStats(cacheRes.data);
    } catch (error) {
      console.error('Failed to load metadata:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsSearching(true);
    try {
      const res = await semanticAPI.findSimilar(query, threshold, limit);
      setResults(res.data.similar_goals || []);
      
      if (res.data.similar_goals?.length === 0) {
        toast('No similar goals found', { icon: '🔍' });
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        Semantic Search
      </h1>

      {/* Search Section */}
      <div className="card mb-8">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for similar past goals..."
              className="input w-full pl-10 text-lg"
              disabled={isSearching}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Similarity Threshold: {(threshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Less Similar</span>
                <span>More Similar</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Results: {limit}
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="btn-primary w-full"
          >
            {isSearching ? 'Searching...' : 'Search Similar Goals'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Search Results ({results.length})
          </h2>
          <div className="space-y-3">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4"
                style={{
                  borderLeftColor: result.success ? '#10b981' : '#ef4444',
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="flex-1 text-gray-900 dark:text-gray-100 font-medium">
                    {result.goal}
                  </p>
                  <div className="ml-4 flex items-center space-x-2">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded ${
                    result.success
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    {result.success ? 'Success' : 'Failed'}
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${result.similarity * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {(result.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Patterns */}
        {patterns && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Patterns
              </h2>
            </div>
            <div className="space-y-3">
              {patterns.common_themes && patterns.common_themes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Common Themes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {patterns.common_themes.map((theme, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-full"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {patterns.success_rate !== undefined && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Overall Success Rate
                  </h3>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${patterns.success_rate * 100}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {(patterns.success_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cache Stats */}
        {cacheStats && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Cache Statistics
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Cache Hit Rate</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {((cacheStats.hit_rate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(cacheStats.hit_rate || 0) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {cacheStats.total_embeddings || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Embeddings</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {cacheStats.cache_size || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cache Size</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
