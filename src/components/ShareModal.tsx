import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  Send,
  Mail,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Heart,
  Briefcase,
  Smile,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GREETING_PRESETS = [
  {
    id: 'casual',
    label: 'Friendly Greeting',
    icon: Smile,
    text: "Hey! Thought you'd love yourPDFworld (https://yourPDFworld.com) - Your Complete PDF Solution! You can merge, compress, split, edit text, and batch process PDFs directly in your browser with 100% privacy and zero uploads!",
  },
  {
    id: 'work',
    label: 'Colleague / Professional',
    icon: Briefcase,
    text: "Hi! I recommend checking out yourPDFworld (https://yourPDFworld.com) for secure document workflows. It processes files entirely in client-side memory without sending sensitive documents to external servers.",
  },
  {
    id: 'quick',
    label: 'Quick Recommendation',
    icon: Sparkles,
    text: "Found this amazing free PDF workstation: yourPDFworld.com! Your Complete PDF Solution. No registration required, no paywalls, and 100% private.",
  },
];

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('casual');
  const [customMessage, setCustomMessage] = useState<string>(GREETING_PRESETS[0].text);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedUrlOnly, setCopiedUrlOnly] = useState<boolean>(false);

  // Get current app URL safely with yourPDFworld.com default
  const appUrl = typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://yourPDFworld.com';

  useEffect(() => {
    const preset = GREETING_PRESETS.find((p) => p.id === selectedPreset);
    if (preset) {
      setCustomMessage(preset.text);
    }
  }, [selectedPreset]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fullShareText = `${customMessage}\n\n👉 Try it here: ${appUrl}`;

  const handleCopyFull = async () => {
    try {
      await navigator.clipboard.writeText(fullShareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrlOnly(true);
      setTimeout(() => setCopiedUrlOnly(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Web Share API support
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'yourPDFworld - Your Complete PDF Solution',
          text: customMessage,
          url: appUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyFull();
        }
      }
    } else {
      handleCopyFull();
    }
  };

  const encodedText = encodeURIComponent(customMessage);
  const encodedUrl = encodeURIComponent(appUrl);
  const encodedFull = encodeURIComponent(fullShareText);

  // Direct Sharing Links
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedFull}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent('Check out yourPDFworld - Your Complete PDF Solution')}&body=${encodedFull}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Share yourPDFworld.com
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your Complete PDF Solution. Share with a friendly greeting or note.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Greeting Presets Selector */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Choose Greeting Tone
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {GREETING_PRESETS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editable Message Box */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Greeting Message (Editable)
          </label>
          <textarea
            rows={3}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
            placeholder="Type your greeting message..."
          />
        </div>

        {/* 1-Click Social / Messenger Share Targets */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Quick Share Platforms
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">WhatsApp</span>
            </a>

            {/* Email */}
            <a
              href={mailtoUrl}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-600 bg-white dark:bg-slate-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">Email</span>
            </a>

            {/* X (Twitter) */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                𝕏
              </div>
              <span className="truncate">Post on X</span>
            </a>

            {/* Telegram */}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-600 bg-white dark:bg-slate-900 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">Telegram</span>
            </a>
          </div>
        </div>

        {/* Copy Link & Action Buttons */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {/* Link URL Bar */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <span className="px-2 text-xs font-mono text-slate-500 dark:text-slate-400 truncate flex-1">
              {appUrl}
            </span>
            <button
              onClick={handleCopyUrl}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
            >
              {copiedUrlOnly ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Buttons: Copy All Message + System Share */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={handleCopyFull}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Greeting & Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Full Greeting & Link</span>
                </>
              )}
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Open system share sheet"
              >
                <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>More Share Options</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
