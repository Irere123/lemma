import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ApiKeysSkeleton() {
  return (
    <Table className='border border-border'>
      <TableHeader className='bg-muted'>
        <TableRow>
          <TableHead className='text-right'>Name</TableHead>
          <TableHead className='text-right'>Permissions</TableHead>
          <TableHead className='text-right'>Created</TableHead>
          <TableHead className='text-right border-r-[0px]'>Last used</TableHead>
          <TableHead className='text-right'></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 4 }).map((_, index) => (
          <TableRow key={index} className='hover:bg-transparent'>
            <TableCell className='border-r-[0px] py-4 text-right'>
              <Skeleton className='h-4 w-32' />
            </TableCell>
            <TableCell className='border-r-[0px] py-4 text-right'>
              <Skeleton className='h-6 w-20 rounded-full' />
            </TableCell>
            <TableCell className='border-r-[0px] py-4 text-right'>
              <Skeleton className='h-4 w-24' />
            </TableCell>
            <TableCell className='border-r-[0px] py-4 text-right'>
              <Skeleton className='h-4 w-20' />
            </TableCell>
            <TableCell className='border-r-[0px] py-4 text-right'>
              <Skeleton className='h-8 w-8 rounded' />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
