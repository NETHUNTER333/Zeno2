import React, { useState } from 'react';
import { UserAccountStore } from '../lib/userAccountStore';
import { auth, getAuthHeaders } from '../lib/firebase';

interface DeleteAccountButtonProps {
  isDark?: boolean;
  onDeleted?: () => void;
}

export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({ isDark = true, onDeleted }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText.trim() !== 'DELETE') {
      setError('Please type DELETE in uppercase to confirm permanent account deletion.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const currentUid = auth.currentUser?.uid;
      try {
        const headers = await getAuthHeaders();
        await fetch('/api/account/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            confirmation: 'DELETE',
            uid: currentUid,
          }),
        });
      } catch {}

      await UserAccountStore.deleteAccount();
      setShowConfirm(false);
      setConfirmText('');
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-red-500">Delete My Account (DPDP &amp; GDPR Right to Erasure)</div>
            <div className="text-xs text-neutral-400 mt-0.5">
              Permanently delete your account, chat history, study sets, and associated personal data (completed immediately and purged from backups within 30 days).
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmText('');
              setError(null);
              setShowConfirm(true);
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all shrink-0"
          >
            Delete My Account
          </button>
        </div>
        {error && <div className="text-xs text-red-400 font-medium">{error}</div>}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border space-y-4 shadow-2xl ${
            isDark ? 'bg-neutral-900 border-white/10 text-white' : 'bg-white border-black/10 text-neutral-900'
          }`}>
            <h3 className="text-lg font-bold text-red-500">Confirm Permanent Account Deletion</h3>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              This action is irreversible. Your profile, chat history, YouTube/PDF study sets, and referral records will be deleted immediately and fully purged within 30 days.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">
                Type <code className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono">DELETE</code> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none ${
                  isDark
                    ? 'bg-black/40 border-white/15 text-white focus:border-red-500'
                    : 'bg-neutral-50 border-black/15 text-black focus:border-red-500'
                }`}
              />
            </div>
            {error && <div className="text-xs text-red-400 font-medium">{error}</div>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  isDark ? 'border-white/10 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || confirmText.trim() !== 'DELETE'}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
