import { useAppStore } from '@/store/useAppStore';

export const HEADER = 'Status,Date,Description,Debit,Credit,Member Name';

export const SAMPLE_CSV = [
  HEADER,
  'Cleared,07/03/2026,"APPLE.COM/BILL CUPERTINO CA",4.99,,ALEX SAMPLE',
  'Cleared,07/02/2026,"AMAZON MKTPL*DEMO1234 SEATTLE WA",32.50,,JAMIE SAMPLE',
  'Cleared,07/01/2026,"HARRIS TEETER #0042 CHARLOTTE NC",118.37,,ALEX SAMPLE',
  'Cleared,07/01/2026,"McDonalds 00001 CHARLOTTE NC",11.62,,JAMIE SAMPLE',
  'Cleared,06/30/2026,"ONLINE PAYMENT, THANK YOU",,-1500.00,ALEX SAMPLE',
  'Cleared,06/29/2026,"LOWES #01111 BELMONT NC",86.14,,ALEX SAMPLE',
  'Cleared,06/16/2026,"Merchant Offers Credit NY",,-2.15,ALEX SAMPLE',
].join('\n');

export const SECOND_CSV = [
  HEADER,
  'Cleared,06/29/2026,"LOWES #01111 BELMONT NC",86.14,,ALEX SAMPLE',
  'Cleared,06/15/2026,"HULU 123-456-7890 CA",17.99,,JAMIE SAMPLE',
].join('\n');

export function csvFile(text: string, name = 'statement.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

export async function seedStore(text = SAMPLE_CSV) {
  await useAppStore.getState().uploadFiles([csvFile(text)]);
}

export function resetStore() {
  useAppStore.getState().resetAll();
}
