import { router, useLocalSearchParams } from 'expo-router';

import { ReportForm } from '@/components/safety/ReportForm';

/** Denúncia direto do card da tela Descobrir, antes de qualquer match. */
export default function ReportProfileScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  return <ReportForm profile={{ id, name: name ?? '' }} onDone={() => router.back()} />;
}
