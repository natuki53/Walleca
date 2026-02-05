'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { receiptsApi } from '@/api/receipts';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

function hasAllowedImageExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function hasHeicExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isSupportedImageFile(file: File) {
  const mimeType = (file.type || '').toLowerCase();

  if (mimeType.startsWith('image/')) {
    return true;
  }

  const isGenericMimeType = mimeType === '' || mimeType === 'application/octet-stream';
  return isGenericMimeType && hasAllowedImageExtension(file.name);
}

function isHeicLikeFile(file: File) {
  const mimeType = (file.type || '').toLowerCase();
  return HEIC_MIME_TYPES.includes(mimeType) || hasHeicExtension(file.name);
}

function replaceExtensionWithJpeg(fileName: string) {
  const normalizedName = fileName.trim();
  if (!normalizedName) {
    return 'receipt.jpg';
  }

  const dotIndex = normalizedName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${normalizedName}.jpg`;
  }

  return `${normalizedName.slice(0, dotIndex)}.jpg`;
}

type Heic2AnyConvert = (options: {
  blob: Blob;
  toType?: string;
  quality?: number;
  gifInterval?: number;
  multiple?: boolean;
}) => Promise<Blob | Blob[]>;

type HeicToConvert = (options: {
  blob: Blob;
  type: 'image/jpeg';
  quality?: number;
}) => Promise<Blob | ArrayBuffer | Uint8Array>;

function normalizeToBlob(value: unknown): Blob | null {
  if (value instanceof Blob) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Blob([value], { type: 'image/jpeg' });
  }

  if (value instanceof Uint8Array) {
    return new Blob([new Uint8Array(value)], { type: 'image/jpeg' });
  }

  return null;
}

function describeConversionError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== '{}' ? serialized : '不明なエラー';
  } catch {
    return '不明なエラー';
  }
}

async function convertHeicToJpegWithHeicTo(candidates: Blob[]): Promise<Blob> {
  const heicToModule = await import('heic-to');
  const converter = ((heicToModule as unknown as { default?: HeicToConvert; heicTo?: HeicToConvert }).heicTo
    ?? (heicToModule as unknown as { default?: HeicToConvert; heicTo?: HeicToConvert }).default);

  if (typeof converter !== 'function') {
    throw new Error('heic-to converter not found');
  }

  let lastError: unknown;
  for (const blob of candidates) {
    try {
      const converted = await converter({
        blob,
        type: 'image/jpeg',
        quality: 0.92,
      });

      const normalizedBlob = normalizeToBlob(converted);
      if (normalizedBlob) {
        return normalizedBlob;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('heic-to conversion failed');
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2anyModule = await import('heic2any');
  const heic2any = heic2anyModule.default as Heic2AnyConvert;
  const buffer = await file.arrayBuffer();

  const candidates: Blob[] = [
    file,
    new Blob([buffer], { type: 'image/heic' }),
    new Blob([buffer], { type: 'image/heif' }),
    new Blob([buffer], { type: '' }),
  ];

  let lastError: unknown;

  for (const blob of candidates) {
    try {
      const converted = await heic2any({
        blob,
        toType: 'image/jpeg',
        quality: 0.92,
        multiple: false,
      });
      const convertedBlob = Array.isArray(converted) ? converted[0] : converted;

      if (convertedBlob instanceof Blob) {
        return convertedBlob;
      }
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await convertHeicToJpegWithHeicTo(candidates);
  } catch (error) {
    throw error ?? lastError ?? new Error('HEIC conversion failed');
  }
}

export function ReceiptUploader() {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewUnavailable, setIsPreviewUnavailable] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const resetUploader = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setIsPreviewLoading(false);
    setIsPreviewUnavailable(false);
    revokePreviewUrl();
  }, [revokePreviewUrl]);

  const setPreviewFromBlob = useCallback(
    (blob: Blob) => {
      revokePreviewUrl();
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setIsPreviewUnavailable(false);
      setPreview(previewUrl);
    },
    [revokePreviewUrl]
  );

  useEffect(() => {
    return () => {
      revokePreviewUrl();
    };
  }, [revokePreviewUrl]);

  const uploadMutation = useMutation({
    mutationFn: receiptsApi.upload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'レシートをアップロードしました' });
      resetUploader();
    },
    onError: () => {
      toast({ title: 'アップロードに失敗しました', variant: 'destructive' });
    },
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedImageFile(file)) {
        toast({
          title: '対応形式は JPG / PNG / WebP / HEIC / HEIF です',
          variant: 'destructive',
        });
        return;
      }

      if (isHeicLikeFile(file)) {
        setSelectedFile(file);
        setPreview(null);
        setIsPreviewUnavailable(false);
        setIsPreviewLoading(true);

        try {
          const convertedBlob = await convertHeicToJpeg(file);
          const convertedFile = new File(
            [convertedBlob],
            replaceExtensionWithJpeg(file.name),
            { type: 'image/jpeg', lastModified: file.lastModified }
          );

          setSelectedFile(convertedFile);
          setPreviewFromBlob(convertedBlob);
          toast({
            title: 'HEIC/HEIF を JPEG に変換しました',
            description: '変換後の画像でアップロードします',
          });
        } catch (error: unknown) {
          resetUploader();
          toast({
            title: 'HEIC/HEIF の変換に失敗しました',
            description: `クライアント変換に失敗: ${describeConversionError(error)}`,
            variant: 'destructive',
          });
        } finally {
          setIsPreviewLoading(false);
        }
        return;
      }

      setSelectedFile(file);
      setPreviewFromBlob(file);
      setIsPreviewLoading(false);
      setIsPreviewUnavailable(false);
    },
    [resetUploader, setPreviewFromBlob]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        void handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleUpload = () => {
    if (selectedFile && !isPreviewLoading) {
      uploadMutation.mutate(selectedFile);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        {!selectedFile ? (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              レシート画像をドラッグ＆ドロップ
            </p>
            <p className="text-xs text-muted-foreground mt-1">または</p>
            <label>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    void handleFile(e.target.files[0]);
                  }
                }}
              />
              <Button variant="outline" className="mt-4" asChild>
                <span>ファイルを選択</span>
              </Button>
            </label>
            <label>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    void handleFile(e.target.files[0]);
                  }
                }}
              />
              <Button className="mt-4 ml-2" asChild>
                <span>カメラで撮影</span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              {preview && !isPreviewUnavailable ? (
                <Image
                  src={preview}
                  alt="Preview"
                  width={800}
                  height={600}
                  className="max-h-64 w-auto mx-auto rounded-lg"
                  unoptimized
                  onError={() => {
                    setIsPreviewUnavailable(true);
                  }}
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  {isPreviewLoading
                    ? 'プレビューを読み込み中...'
                    : 'この形式はプレビュー非対応ですがアップロードできます'}
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => {
                  resetUploader();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetUploader();
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || isPreviewLoading}
              >
                {uploadMutation.isPending
                  ? 'アップロード中...'
                  : isPreviewLoading
                    ? '変換中...'
                    : 'アップロード'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
