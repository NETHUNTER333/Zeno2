import React, { useState } from 'react';
import { UserAccountStore } from '../lib/userAccountStore';

interface DeleteAccountButtonProps {
  isDark?: boolean;
  onDeleted?: () => void;
}

export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({ isDark = true, onDeleted }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError(null);
      await UserAccountStore.deleteAccount();
      setShowConfirm(false);
      if (onDeleted) onDeleted();
    } catch (err: any) {
      console.error('Delete account failed:', err);
      setError(err?.message || 'Failed to delete account. Please re-authenticate and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-red-950/10 border-red-500/20' : 'bg-red-50 border-red-200'
      } space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-red-500">Danger Zone: Delete Account</div>
            <div className="text-xs text-neutral-400 mt-0.5">Permanently delete your account and all associated data from Firebase</div>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all"
          >
            Delete Account
          </button>
        </div>
        {error && <div className="text-xs text-red-400 font-medium">{error}</div>}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 shadow-2xl ${
            isDark ? 'bg-neutral-900 border-white/10 text-white' : 'bg-white border-black/10 text-neutral-900'
          }`}>
            <h3 className="text-lg font-bold text-red-500">Confirm Account Deletion</h3>
            <p className="text-xs sm:text-sm text-neutral-400">
              Are you sure you want to permanently delete your account? This action cannot be undone and will remove all your data from Firebase Authentication and Firestore.
            </p>
            {error && <div className="text-xs text-red-400 font-medium">{error}</div>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  isDark ? 'border-white/10 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
