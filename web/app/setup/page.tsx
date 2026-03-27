import BaseLayout from '@/components/BaseLayout'
import ProjectSetupWizard from '@/components/ProjectSetupWizard'

export default function SetupPage() {
  return (
    <BaseLayout>
      <ProjectSetupWizard 
        onComplete={(projectId) => {
          window.location.href = `/dashboard?project_id=${projectId}`
        }}
        onCancel={() => {
          window.location.href = '/'
        }}
      />
    </BaseLayout>
  )
}