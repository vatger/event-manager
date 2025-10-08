import React from 'react'
import { Separator } from './ui/separator'
import Link from 'next/link'

const Footer = () => {
  return (
    <div className='px-4 pb-4'>
      <Separator orientation='horizontal' className='my-4' />
      <footer className="flex h-5 items-center space-x-4 text-sm justify-center text-muted-foreground">
        <Link href="https://vatsim-germany.org/policies/gdpr" target='_blank'>GDPR</Link>
        <Separator orientation='vertical' className='mx-2 inline-block h-4' />
        <Link href="https://vatsim-germany.org/policies/imprint" target='_blank'>Imprint</Link>
      </footer>
    </div>
  )
}

export default Footer
