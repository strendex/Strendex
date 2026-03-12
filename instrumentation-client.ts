import posthog from 'posthog-js'

console.log('POSTHOG instrumentation-client loaded')

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: '2025-05-24',
  debug: true,
  loaded: (posthogInstance) => {
    console.log('POSTHOG init finished')
    posthogInstance.capture('stx test event', {
      source: 'localhost',
    })
  },
})