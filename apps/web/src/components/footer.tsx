export function Footer() {
  return (
    <footer className='mx-auto flex w-full max-w-2xl justify-between border-neutral-300 border-t pt-6 text-neutral-500 text-sm sm:px-1 px-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-neutral-500 font-hand-writing'>v0.1</p>
      </div>
      <div className='flex sm:flex-col items-center gap-2 flex-row'>
        <a
          href='https://api.irere.dev'
          className='text-sm font-bold hover:underline'
          target='_blank'
          rel='noopener'
        >
          API
        </a>
        <a
          href='https://github.com/Irere123/lemma'
          className='text-sm font-bold hover:underline'
          target='_blank'
          rel='noopener'
        >
          Github
        </a>
        <a
          href='https://x.com/codesdoes'
          className='text-sm font-bold hover:underline'
          target='_blank'
          rel='noopener'
        >
          Twitter/X
        </a>
      </div>
    </footer>
  )
}
