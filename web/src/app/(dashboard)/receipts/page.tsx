import { redirect } from 'next/navigation';

export default function ReceiptsPage() {
  redirect('/transactions?action=receipt');
}
