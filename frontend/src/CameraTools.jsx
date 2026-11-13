import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera, QrCode, Upload, X, RefreshCw, CheckCircle2, AlertCircle, Download, ScanBarcode, Sparkles
} from 'lucide-react';

export function isSafeDropInstruction(instruction) {
  if (!instruction) return false;
  const s = instruction.toLowerCase();
  return s.includes('doorstep') || s.includes('contactless') || s.includes('safe-drop');
}

export function getActivePassOtp(parcel, currentUser) {
  if (!parcel) return '';
  const userFlat = (currentUser?.flatNumber || '').trim().toUpperCase();
  const isDelegateReceiver =
    parcel.delegated &&
    parcel.delegateFlat &&
    userFlat &&
    parcel.delegateFlat.trim().toUpperCase() === userFlat &&
    parcel.flatNumber?.trim().toUpperCase() !== userFlat;

  if (isDelegateReceiver) {
    return parcel.delegateOtp || '';
  }
  return parcel.returnOtp || parcel.demoOtp || parcel.delegateOtp || '';
}

export function encodePassQrPayload(parcel, otpOverride) {
  if (!parcel) return '';
  const otp = otpOverride || parcel.demoOtp || parcel.delegateOtp || parcel.returnOtp || '';
  if (parcel.bundled && parcel.bundleCode) {
    return `SPBUNDLE|${parcel.bundleCode}|${otp}|${parcel.bundleSize || 1}`;
  }
  if (parcel.returnPickup) {
    return `SPRETURN|${parcel.id}|${parcel.trackingNumber}|${otp}`;
  }
  return `SPPASS|${parcel.id}|${parcel.trackingNumber}|${otp}`;
}

export function parseScannedScanResult(rawText, scanMode = 'barcode') {
  const cleaned = (rawText || '').trim();
  if (!cleaned) return { valid: false };

  if (cleaned.startsWith('SPBUNDLE|')) {
    const parts = cleaned.split('|');
    const bundleCode = (parts[1] || '').trim();
    const otp = (parts[2] || '').replace(/\D/g, '').slice(0, 6);
    const bundleSize = Number(parts[3]) || 1;
    return {
      valid: Boolean(bundleCode),
      kind: 'BUNDLE_QR',
      bundleCode,
      otp,
      bundleSize
    };
  }

  if (cleaned.startsWith('SPRETURN|')) {
    const parts = cleaned.split('|');
    const parcelId = Number(parts[1]) || null;
    const trackingNumber = (parts[2] || '').trim().toUpperCase();
    const otp = (parts[3] || '').replace(/\D/g, '').slice(0, 6);
    return {
      valid: Boolean(parcelId || trackingNumber),
      kind: 'RETURN_QR',
      parcelId,
      trackingNumber,
      otp
    };
  }

  if (cleaned.startsWith('SPPASS|')) {
    const parts = cleaned.split('|');
    const parcelId = Number(parts[1]) || null;
    const trackingNumber = (parts[2] || '').trim().toUpperCase();
    const otp = (parts[3] || '').replace(/\D/g, '').slice(0, 6);
    return {
      valid: Boolean(parcelId || trackingNumber),
      kind: 'PASS_QR',
      parcelId,
      trackingNumber,
      otp
    };
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && (parsed.parcelId || parsed.trackingNumber || parsed.otp)) {
      return {
        valid: true,
        kind: 'PASS_QR',
        parcelId: parsed.parcelId ? Number(parsed.parcelId) : null,
        trackingNumber: (parsed.trackingNumber || '').toString().trim().toUpperCase(),
        otp: (parsed.otp || '').toString().replace(/\D/g, '').slice(0, 6)
      };
    }
  } catch (_) {}

  if (scanMode === 'pass-qr' && /^\d{6}$/.test(cleaned)) {
    return { valid: true, kind: 'OTP_ONLY', otp: cleaned };
  }

  const normalizedTracking = cleaned
    .replace(/^https?:\/\/[^/]+\//i, '')
    .split(/[\s?#]/)[0]
    .toUpperCase()
    .slice(0, 36);

  return {
    valid: Boolean(normalizedTracking),
    kind: 'BARCODE',
    trackingNumber: normalizedTracking,
    raw: cleaned
  };
}

export function compressImageFileToDataUrl(sourceFile, maxWidth = 760, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(sourceFile);
  });
}

export function PassQrCode({ payload, trackingNumber, activeOtp, onActivateQr, activating }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setDataUrl('');
      return;
    }
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: { dark: '#17132a', light: '#ffffff' }
    })
      .then(url => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => { cancelled = true; };
  }, [payload]);

  function handleDownloadPng() {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `SmartParcel-Pass-${trackingNumber || 'QR'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const isBundle = (payload || '').startsWith('SPBUNDLE');
  const isReturn = (payload || '').startsWith('SPRETURN');

  return (
    <div className="simulatedQr">
      {activeOtp && dataUrl ? (
        <>
          <img
            src={dataUrl}
            alt={`Digital Pass QR for ${trackingNumber}`}
            className="qrPassImg"
          />
          <div className="qrStatusPill ready">
            <CheckCircle2 size={13} />
            <span>
              {isReturn
                ? `Reverse Pickup Pass Active · OTP ${activeOtp}`
                : isBundle
                ? `Master Bundle Pass Active · OTP ${activeOtp}`
                : `Scannable Pickup Pass Active · OTP ${activeOtp}`}
            </span>
          </div>
          <small>
            {isReturn
              ? 'Show this Reverse QR code or 6-digit OTP to the courier partner collecting your return.'
              : isBundle
              ? 'Show this Master QR code or OTP to receive all bundled deliveries in 1 single handover.'
              : 'Show this live QR code or 6-digit OTP to your Delivery Agent for 1-scan handover verification.'}
          </small>
          <button type="button" className="ep-btnGhost qrDownloadBtn" onClick={handleDownloadPng}>
            <Download size={13} />
            <span>Download Pass QR PNG</span>
          </button>
        </>
      ) : (
        <>
          <div className="qrPendingBox">
            <QrCode size={62} color="#5b21b6" />
            <span>OTP not generated yet for this parcel</span>
          </div>
          <small>
            Activate your live Pass QR now so your Delivery Agent can scan and complete handover automatically.
          </small>
          {onActivateQr && (
            <button
              type="button"
              className="ep-btnPrimary"
              style={{ marginTop: 6 }}
              onClick={onActivateQr}
              disabled={activating}
            >
              <Sparkles size={14} />
              <span>{activating ? 'Activating QR Pass...' : 'Activate Live Pickup QR'}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function CameraScannerModal({ open, mode = 'barcode', title, subtitle, onClose, onDetected }) {
  const scannerId = 'sp-html5-qr-reader';
  const qrRef = useRef(null);
  const fileInputRef = useRef(null);
  const detectedLockRef = useRef(false);

  const [cameraState, setCameraState] = useState('starting'); // 'starting' | 'active' | 'unavailable'
  const [errorMsg, setErrorMsg] = useState('');
  const [manualRaw, setManualRaw] = useState('');

  useEffect(() => {
    if (!open) return;
    detectedLockRef.current = false;
    setErrorMsg('');
    setManualRaw('');
    setCameraState('starting');

    let mounted = true;
    const html5Qr = new Html5Qrcode(scannerId, { verbose: false });
    qrRef.current = html5Qr;

    async function startCamera() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;
        if (!cameras || cameras.length === 0) {
          setCameraState('unavailable');
          setErrorMsg('No live camera detected on this device. Upload a QR / barcode image below instead.');
          return;
        }
        const backCam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[0];
        await html5Qr.start(
          backCam.id,
          { fps: 10, qrbox: mode === 'barcode' ? { width: 260, height: 150 } : { width: 220, height: 220 } },
          decodedText => {
            if (!mounted || detectedLockRef.current) return;
            detectedLockRef.current = true;
            html5Qr.stop().catch(() => {}).finally(() => {
              onDetected(decodedText);
            });
          },
          () => {}
        );
        if (mounted) setCameraState('active');
      } catch (err) {
        if (!mounted) return;
        setCameraState('unavailable');
        setErrorMsg(
          err?.message?.includes('Permission') || String(err).includes('NotAllowedError')
            ? 'Camera permission denied. Upload a QR / barcode photo or paste the scan code below.'
            : 'Camera could not start here. You can upload a QR / barcode photo below.'
        );
      }
    }

    const timer = setTimeout(startCamera, 80);

    return () => {
      mounted = false;
      clearTimeout(timer);
      const inst = qrRef.current;
      qrRef.current = null;
      if (inst) {
        try {
          if (inst.isScanning) {
            inst.stop().then(() => inst.clear()).catch(() => {});
          } else {
            inst.clear();
          }
        } catch (_) {}
      }
    };
  }, [open, mode]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    try {
      const inst = qrRef.current || new Html5Qrcode(scannerId, { verbose: false });
      if (inst.isScanning) {
        await inst.stop().catch(() => {});
      }
      const decoded = await inst.scanFile(file, false);
      onDetected(decoded);
    } catch (_) {
      setErrorMsg('Could not read a valid barcode or QR code from that image. Please try a clearer image.');
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualRaw.trim()) return;
    onDetected(manualRaw.trim());
  }

  if (!open) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent scannerModal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h3>{title || (mode === 'pass-qr' ? 'Scan Resident Digital Pass QR' : 'Scan Parcel Barcode / AWB')}</h3>
            <p className="chatSubHeader">
              {subtitle || (mode === 'pass-qr'
                ? 'Point camera at resident QR pass to verify & complete handover automatically'
                : 'Point camera at courier label barcode or QR to auto-fill tracking number')}
            </p>
          </div>
          <button type="button" className="closeBtn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modalBody scannerModalBody">
          <div className={`scannerViewport ${cameraState === 'active' ? 'live' : ''}`}>
            <div id={scannerId} className="scannerTargetEl" />
            {cameraState === 'starting' && (
              <div className="scannerOverlayState">
                <RefreshCw size={22} className="spin" color="#5b21b6" />
                <span>Initializing camera scanner...</span>
              </div>
            )}
            {cameraState === 'unavailable' && (
              <div className="scannerOverlayState">
                <Camera size={26} color="#908ba6" />
                <span>Live camera unavailable</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="scannerErrorBanner">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="scannerAltTools">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="ep-btnGhost fullWidth"
              style={{ justifyContent: 'center' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} />
              <span>Scan from Saved QR / Barcode Photo</span>
            </button>

            <form onSubmit={handleManualSubmit} className="scannerPasteForm">
              <ScanBarcode size={15} color="#5d5876" />
              <input
                type="text"
                placeholder={mode === 'pass-qr' ? 'Or paste SPPASS|... QR payload / 6-digit OTP' : 'Or type / hardware-scan tracking AWB'}
                value={manualRaw}
                onChange={e => setManualRaw(e.target.value)}
              />
              <button type="submit" className="ep-btnPrimary" style={{ padding: '7px 12px', fontSize: 12 }}>
                Apply
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhotoCaptureModal({ open, title, onClose, onCaptured }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [camError, setCamError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCamError('');
    setStarting(true);

    async function openCam() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (active) {
          setStarting(false);
          setCamError('Live camera API unavailable in this browser context. Upload a photo file below.');
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStarting(false);
      } catch (_) {
        if (active) {
          setStarting(false);
          setCamError('Camera permission blocked or unavailable. Use "Upload Doorstep Photo" below.');
        }
      }
    }

    openCam();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  function handleSnapFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxW = 760;
    const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    onCaptured(dataUrl);
    onClose();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      onCaptured(dataUrl);
      onClose();
    } catch (err) {
      setCamError(err.message || 'Could not process image.');
    }
  }

  if (!open) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent scannerModal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h3>{title || 'Capture Doorstep Proof of Delivery'}</h3>
            <p className="chatSubHeader">Snap parcel safely placed at apartment door or upload a photo</p>
          </div>
          <button type="button" className="closeBtn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modalBody scannerModalBody">
          <div className="photoCamBox">
            {camError ? (
              <div className="scannerOverlayState">
                <Camera size={28} color="#908ba6" />
                <span>{camError}</span>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="photoCamVideo" />
                {starting && (
                  <div className="scannerOverlayState">
                    <RefreshCw size={22} className="spin" color="#5b21b6" />
                    <span>Starting camera...</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="photoCamActions">
            {!camError && !starting && (
              <button type="button" className="ep-btnPrimary fullWidth" onClick={handleSnapFrame}>
                <Camera size={15} />
                <span>Capture Safe-Drop Snapshot</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="ep-btnGhost fullWidth"
              style={{ justifyContent: 'center' }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={15} />
              <span>Upload Doorstep Photo File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

