'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Attachment } from '@/lib/types/p1';

interface FileUploadProps {
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
  maxFiles?: number;
  maxSize?: number; // bytes
}

export default function FileUpload({
  files,
  onChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newAttachments: Attachment[] = acceptedFiles.map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        type: getFileType(file.name),
        size: file.size,
        url: URL.createObjectURL(file),
      }));

      onChange([...files, ...newAttachments].slice(0, maxFiles));
    },
    [files, onChange, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: maxFiles - files.length,
    maxSize,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
  });

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'image':
        return '🖼️';
      default:
        return '📎';
    }
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-2">📎</div>
        <p className="text-sm text-slate-600">
          {isDragActive
            ? '松开以上传文件'
            : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          支持 PDF, Word, Excel, 图片 (最大 {formatFileSize(maxSize)})
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(file.type)}</span>
                <div>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getFileType(filename: string): Attachment['type'] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'png':
    case 'jpg':
    case 'jpeg':
      return 'image';
    default:
      return 'pdf';
  }
}
