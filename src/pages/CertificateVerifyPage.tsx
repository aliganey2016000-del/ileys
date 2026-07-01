import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Calendar, User, BookOpen, Shield, Loader2, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CertificateData {
  student_name: string;
  course_title: string;
  completed_at: string;
  certificate_id: string;
  instructor_name: string;
}

export function CertificateVerifyPage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      if (!certificateId) {
        setError('No certificate ID provided.');
        setLoading(false);
        return;
      }
      try {
        const { data, error: dbErr } = await supabase
          .from('course_completions')
          .select(`
            certificate_id,
            completed_at,
            profiles:student_id (full_name),
            courses:course_id (title, instructor_id)
          `)
          .eq('certificate_id', certificateId)
          .single();

        if (dbErr || !data) {
          setError('Certificate not found. Please check the certificate ID and try again.');
          setLoading(false);
          return;
        }

        const course = data.courses as { title: string; instructor_id?: string } | null;
        let instructorName = 'Michael Johnson';

        if (course?.instructor_id) {
          const { data: inst } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', course.instructor_id)
            .single();
          if (inst?.full_name) instructorName = inst.full_name;
        }

        const profile = data.profiles as { full_name: string } | null;
        setCertificate({
          student_name: profile?.full_name || 'Student',
          course_title: course?.title || 'Course',
          completed_at: data.completed_at,
          certificate_id: data.certificate_id,
          instructor_name: instructorName,
        });
      } catch {
        setError('An error occurred while verifying the certificate.');
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [certificateId]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg">
            <span className="text-white font-extrabold text-lg tracking-tight">IA</span>
          </div>
          <div>
            <p className="font-bold text-xl text-slate-800 leading-none">Ilesy Academy</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Certificate Verification</p>
          </div>
        </div>

        {certificate ? (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
            {/* Success banner */}
            <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 px-6 py-8 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 left-4 w-20 h-20 rounded-full bg-white" />
                <div className="absolute bottom-2 right-4 w-14 h-14 rounded-full bg-white" />
              </div>
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Certificate Verified</h1>
                <p className="text-green-100 text-sm">This is an official Ilesy Academy certificate</p>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <DetailRow
                icon={<User className="w-4 h-4 text-blue-600" />} bg="bg-blue-50"
                label="Student Name" value={certificate.student_name} large
              />
              <DetailRow
                icon={<BookOpen className="w-4 h-4 text-amber-600" />} bg="bg-amber-50"
                label="Course Completed" value={certificate.course_title} large
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-green-600" />} bg="bg-green-50"
                label="Completion Date" value={fmt(certificate.completed_at)}
              />
              <DetailRow
                icon={<Award className="w-4 h-4 text-violet-600" />} bg="bg-violet-50"
                label="Instructor" value={certificate.instructor_name}
              />
              <DetailRow
                icon={<Shield className="w-4 h-4 text-slate-500" />} bg="bg-slate-50"
                label="Certificate ID" value={certificate.certificate_id} mono
              />

              {/* Status badge */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-emerald-700 text-sm">Valid & Verified</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
            {/* Error banner */}
            <div className="bg-gradient-to-br from-red-500 to-rose-600 px-6 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Not Found</h1>
              <p className="text-red-100 text-sm">This certificate could not be verified</p>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-center text-sm mb-4">{error}</p>
              {certificateId && (
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">ID Checked</p>
                  <p className="font-mono font-bold text-slate-700">{certificateId}</p>
                </div>
              )}
              <p className="text-center text-xs text-slate-500 mt-5">
                Contact{' '}
                <a href="mailto:support@ilesyacademy.com" className="text-blue-600 hover:underline font-medium">
                  support@ilesyacademy.com
                </a>
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Ilesy Academy Certificate Verification System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  bg,
  label,
  value,
  large,
  mono,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
        <p className={`text-slate-900 font-semibold ${large ? 'text-base' : 'text-sm'} ${mono ? 'font-mono text-blue-700' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
