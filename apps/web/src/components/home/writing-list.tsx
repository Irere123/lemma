import { Article } from './article'

export const WritingList = () => {
  return (
    <div className='flex flex-col gap-4 py-6'>
      <Article
        title='How to build a website'
        description='This is a description of the article'
        image='https://via.placeholder.com/150'
        url='https://www.google.com'
        status='published'
        publishedAt={new Date().toISOString()}
        isGrid={false}
      />
    </div>
  )
}
