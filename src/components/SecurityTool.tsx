import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Printer,
  Copy,
  FileEdit,
  MessageSquare,
  FormInput,
  Layers,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { SecurityOptions } from '../types/pdf';
import { encryptPdfDocument, downloadBytes, formatBytes } from '../utils/pdfEngine';
import { renderPdfPageToDataUrl, getPdfPageCount } from '../utils/pdfRenderer';

interface SecurityToolProps {
  onLoadSamples: () => void;
  onPreviewPdf: (file?: File, bytes?: Uint8Array, name?: string) => void;
}

export const SecurityTool: React.FC<SecurityToolProps> = ({
  onLoadSamples,
  onPreviewPdf,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Password fields
  const [userPassword, setUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);

  // Optional owner password
  const [hasOwnerPassword, setHasOwnerPassword] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  // Encryption algorithm
  const [algorithm, setAlgorithm] = useState<'AES-256' | 'RC4'>('AES-256');

  // Permissions
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowHighQualityPrint, setAllowHighQualityPrint] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowModifying, setAllowModifying] = useState(false);
  const [allowAnnotating, setAllowAnnotating] = useState(true);
  const [allowFillingForms, setAllowFillingForms] = useState(true);
  const [allowAssembly, setAllowAssembly] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-slate-200 dark:bg-slate-700' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' };
    if (score <= 3) return { score: 2, label: 'Moderate', color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  };

  const strength = getPasswordStrength(userPassword);
  const passwordsMatch = userPassword.length > 0 && userPassword === confirmPassword;

  useEffect(() => {
    if (!file) {
      setThumbnailUrl(null);
      setResult(null);
      setUserPassword('');
      setConfirmPassword('');
      return;
    }

    let isMounted = true;
    const init = async () => {
      try {
        const count = await getPdfPageCount(file);
        const thumb = await renderPdfPageToDataUrl(file, 1, 0.4);
        if (isMounted) {
          setTotalPages(count);
          setThumbnailUrl(thumb);
        }
      } catch (err) {
        console.error('Failed to load PDF for security:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const handleEncrypt = async () => {
    if (!file) return;

    if (!userPassword) {
      alert('Please enter a password to protect your document.');
      return;
    }

    if (userPassword !== confirmPassword) {
      alert('Passwords do not match. Please verify both password fields.');
      return;
    }

    setIsProcessing(true);
    setProgress(15);

    try {
      const options: SecurityOptions = {
        userPassword,
        ownerPassword: hasOwnerPassword && ownerPassword ? ownerPassword : userPassword,
        algorithm,
        allowPrinting,
        allowHighQualityPrint,
        allowCopying,
        allowModifying,
        allowAnnotating,
        allowFillingForms,
        allowAssembly,
      };

      const res = await encryptPdfDocument(file, options, (p) => setProgress(p));
      setResult(res);

      // Trigger download
      downloadBytes(res.bytes, res.filename);
    } catch (err: unknown) {
      console.error('Encryption error:', err);
      alert((err as Error).message || 'Failed to encrypt document.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Protect & Encrypt PDF Documents
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Add AES-256 bit military-grade password encryption, restrict printing, copying, and content modification.
          </p>
        </div>

        <Dropzone
          onFilesSelected={(files) => {
            setFile(files[0]);
            setResult(null);
          }}
          onLoadSamples={onLoadSamples}
          multiple={false}
          title="Drop a PDF file to encrypt and password-protect"
          subtitle="Set document open passwords, restrict editing, printing, and extraction completely client-side."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Info Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
              <span>·</span>
              <button
                onClick={() => onPreviewPdf(file, undefined, file.name)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Eye className="w-3 h-3" />
                <span>Preview Document</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setFile(null);
            setResult(null);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Change File
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Password & Encryption Configuration */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main User Password Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Document Open Password
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showUserPassword ? 'text' : 'password'}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="Enter secure password..."
                    className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength bar */}
                {userPassword && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 flex-1 max-w-xs mr-3">
                      <div className={`h-1.5 flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <div className={`h-1.5 flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <div className={`h-1.5 flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                    </div>
                    <span className={`text-[11px] font-semibold ${strength.text}`}>
                      {strength.label} Password
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showUserPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to confirm..."
                    className={`w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 font-mono ${
                      confirmPassword && !passwordsMatch
                        ? 'border-rose-300 dark:border-rose-700 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                    }`}
                  />
                  {confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordsMatch ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <X className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  )}
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Encryption Standards & Owner Password */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Encryption Settings
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Encryption Standard
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setAlgorithm('AES-256')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      algorithm === 'AES-256'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        AES-256 bit
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Military-grade modern cipher. Compatible with Acrobat 9.0+, Chrome, Safari, iOS, and Android.
                    </p>
                  </div>

                  <div
                    onClick={() => setAlgorithm('RC4')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      algorithm === 'RC4'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        RC4 128-bit
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Legacy
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Standard compatibility for older legacy PDF readers (Acrobat 5.0+).
                    </p>
                  </div>
                </div>
              </div>

              {/* Master/Owner Password option */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={hasOwnerPassword}
                    onChange={(e) => setHasOwnerPassword(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Set Separate Master / Owner Password (Optional)
                  </span>
                </label>

                {hasOwnerPassword && (
                  <div className="mt-2 pl-6">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      Allows overriding permissions or managing security without revealing the master password to viewers.
                    </p>
                    <div className="relative">
                      <input
                        type={showOwnerPassword ? 'text' : 'password'}
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Enter master password..."
                        className="w-full pl-3 pr-10 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showOwnerPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Granular Permissions Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Document Permissions & Restrictions
              </h3>
              <span className="text-xs text-slate-500">Fine-tune rights</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Printing */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPrinting}
                  onChange={(e) => setAllowPrinting(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allow Printing</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Users can print the PDF
                  </p>
                </div>
              </label>

              {/* Copying */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCopying}
                  onChange={(e) => setAllowCopying(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allow Copying Content</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Extract text & graphics
                  </p>
                </div>
              </label>

              {/* Modifying */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowModifying}
                  onChange={(e) => setAllowModifying(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allow Modifying</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Edit or alter content
                  </p>
                </div>
              </label>

              {/* Annotating */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAnnotating}
                  onChange={(e) => setAllowAnnotating(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allow Annotations</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Add notes & highlights
                  </p>
                </div>
              </label>

              {/* Form filling */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowFillingForms}
                  onChange={(e) => setAllowFillingForms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FormInput className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allow Form Filling</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Fill existing form fields
                  </p>
                </div>
              </label>

              {/* Assembly */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAssembly}
                  onChange={(e) => setAllowAssembly(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allow Page Assembly</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Insert, rotate, or delete
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Security Audit & Action Panel */}
        <div className="lg:col-span-5 space-y-5">
          {/* Security Status Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Security Audit Summary
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {algorithm} Encryption
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard PDF Security Handler R=6 with WebCrypto
                </p>
              </div>
            </div>

            {/* Checklist of enforced policies */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-400">Password Required to Open</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Enforced
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-400">Printing Document</span>
                <span className={allowPrinting ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-rose-600 dark:text-rose-400'}>
                  {allowPrinting ? 'Allowed' : 'Blocked'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-400">Copying Text & Graphics</span>
                <span className={allowCopying ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-rose-600 dark:text-rose-400'}>
                  {allowCopying ? 'Allowed' : 'Blocked'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-400">Content Editing & Changes</span>
                <span className={allowModifying ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-rose-600 dark:text-rose-400'}>
                  {allowModifying ? 'Allowed' : 'Blocked'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-400">Adding Comments / Notes</span>
                <span className={allowAnnotating ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-rose-600 dark:text-rose-400'}>
                  {allowAnnotating ? 'Allowed' : 'Blocked'}
                </span>
              </div>
            </div>

            {/* Encrypt Action Button */}
            <div className="pt-2">
              <button
                onClick={handleEncrypt}
                disabled={isProcessing || !userPassword || !passwordsMatch}
                className="w-full px-6 py-3.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Encrypting ({progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Encrypt & Download PDF</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {!userPassword && (
                <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
                  Enter and confirm an open password to enable encryption.
                </p>
              )}
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Zero-Knowledge Encryption</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your password and documents never travel across the internet. Encryption keys are computed locally using your device&apos;s WebCrypto engine.
            </p>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {result && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                PDF Successfully Encrypted & Downloaded!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {result.filename} ({formatBytes(result.bytes.byteLength)}) · Protected with {algorithm}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadBytes(result.bytes, result.filename)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
