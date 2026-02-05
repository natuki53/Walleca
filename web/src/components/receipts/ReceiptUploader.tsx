'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { receiptsApi } from '@/api/receipts';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

export function ReceiptUploader() {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: receiptsApi.upload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'レシートをアップロードしました' });
      setSelectedFile(null);
      setPreview(null);
    },
    onError: () => {
      toast({ title: 'アップロードに失敗しました', variant: 'destructive' });
    },
  });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: '画像ファイルを選択してください', variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

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
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleUpload = () => {
    if (selectedFile) {
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
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <Button variant="outline" className="mt-4" asChild>
                <span>ファイルを選択</span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Image
                src={preview || ''}
                alt="Preview"
                width={800}
                height={600}
                className="max-h-64 w-auto mx-auto rounded-lg"
                unoptimized
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'アップロード中...' : 'アップロード'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
