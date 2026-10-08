/**
 * The forms of the lesson editor. Every field shows one string of the lesson, compares it with the
 * built-in wording (so a change can be spotted and undone) and shows what the validator found there.
 * Stage 1 edits wording only: the shape of the lesson — which slides, which pieces, which reveal
 * order — stays as it is.
 */

import { optionStyle, Shape } from '../components/optionStyle'
import type { Block, LessonDefinition, Question } from '../lesson/types'
import type { LessonProblem } from '../lesson/validate'
import { Card, TextField } from './fields'
import type { LessonEdit } from './useLessonDraft'

export interface FormProps {
  lesson: LessonDefinition
  /** The lesson that ships with the app — what "original" means. */
  base: LessonDefinition
  update: (edit: LessonEdit) => void
  problems: LessonProblem[]
}

const problemsAt = (problems: LessonProblem[], path: string) => problems.filter((problem) => problem.path === path)

/** Optional text that is cleared goes back to "not there" (not ''), so an undone edit is no edit at all. */
function setOptionalText(owner: object, key: string, value: string) {
  const record = owner as Record<string, unknown>
  if (value === '') delete record[key]
  else record[key] = value
}

function baseBlock(base: LessonDefinition, id: string): Block | undefined {
  for (const step of base.steps) {
    const found = step.blocks.find((block) => block.id === id)
    if (found) return found
  }
  return undefined
}

function editBlock<T extends Block['type']>(
  update: FormProps['update'],
  stepIndex: number,
  blockIndex: number,
  type: T,
  apply: (block: Extract<Block, { type: T }>) => void,
) {
  update((draft) => {
    const block = draft.steps[stepIndex]?.blocks[blockIndex]
    if (block && block.type === type) apply(block as Extract<Block, { type: T }>)
  })
}

// ── lesson info ─────────────────────────────────────────────────────────────

export function LessonInfoForm({ lesson, base, update, problems }: FormProps) {
  const { metadata } = lesson
  return (
    <div className="space-y-5">
      <Card title="The lesson" badge="Start page · slide headers">
        <TextField
          label="Lesson title"
          value={metadata.title}
          original={base.metadata.title}
          problems={problemsAt(problems, 'metadata.title')}
          onChange={(value) => update((draft) => void (draft.metadata.title = value))}
        />
        <TextField
          label="Subtitle"
          value={metadata.subtitle}
          original={base.metadata.subtitle}
          problems={problemsAt(problems, 'metadata.subtitle')}
          onChange={(value) => update((draft) => void (draft.metadata.subtitle = value))}
        />
        <TextField
          label="Level line"
          hint="The small line above the title on the start page."
          value={metadata.level}
          original={base.metadata.level}
          problems={problemsAt(problems, 'metadata.level')}
          onChange={(value) => update((draft) => void (draft.metadata.level = value))}
        />
      </Card>

      <Card title="Before you start" badge="Self-Study">
        {metadata.prerequisites.map((item, index) => (
          <TextField
            key={index}
            label={`Prerequisite ${index + 1}`}
            value={item}
            original={base.metadata.prerequisites[index]}
            problems={problemsAt(problems, `metadata.prerequisites[${index}]`)}
            onChange={(value) => update((draft) => void (draft.metadata.prerequisites[index] = value))}
          />
        ))}
      </Card>

      <Card title="Learning objectives" badge="Self-Study">
        {lesson.objectives.map((item, index) => (
          <TextField
            key={index}
            label={`Objective ${index + 1}`}
            rows={2}
            value={item}
            original={base.objectives[index]}
            problems={problemsAt(problems, `objectives[${index}]`)}
            onChange={(value) => update((draft) => void (draft.objectives[index] = value))}
          />
        ))}
      </Card>

      <Card title="Simulation text" badge="Self-Study">
        {Object.values(lesson.simulations).map((simulation) => (
          <div key={simulation.id} className="space-y-4">
            <TextField
              label="Simulation title"
              value={simulation.title}
              original={base.simulations[simulation.id]?.title}
              problems={problemsAt(problems, `simulations.${simulation.id}.title`)}
              onChange={(value) => update((draft) => void (draft.simulations[simulation.id]!.title = value))}
            />
            {simulation.assumptions.map((item, index) => (
              <TextField
                key={index}
                label={`Assumption ${index + 1}`}
                rows={2}
                value={item}
                original={base.simulations[simulation.id]?.assumptions[index]}
                problems={problemsAt(problems, `simulations.${simulation.id}.assumptions[${index}]`)}
                onChange={(value) => update((draft) => void (draft.simulations[simulation.id]!.assumptions[index] = value))}
              />
            ))}
            <p className="text-xs text-ink-faint">The temperatures and other numbers of the simulation are not editable here.</p>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── one slide ───────────────────────────────────────────────────────────────

export function StepForm({ lesson, base, update, problems, stepIndex, onJumpToSummary }: FormProps & { stepIndex: number; onJumpToSummary: () => void }) {
  const step = lesson.steps[stepIndex]
  if (!step) return null
  const baseStep = base.steps.find((candidate) => candidate.id === step.id)
  const stepPath = `steps[${stepIndex}]`

  /** "Text", or "Text 2" when the slide has several of the same kind. */
  const labelFor = (type: Block['type'], name: string, blockIndex: number) => {
    const same = step.blocks.filter((block) => block.type === type)
    return same.length > 1 ? `${name} ${same.findIndex((block) => block === step.blocks[blockIndex]) + 1}` : name
  }

  return (
    <div className="space-y-5">
      <Card title={`Slide ${stepIndex + 1}`} badge={`${step.minutes} min`}>
        <TextField
          label="Slide title"
          value={step.title}
          original={baseStep?.title}
          problems={problemsAt(problems, `${stepPath}.title`)}
          onChange={(value) => update((draft) => void (draft.steps[stepIndex]!.title = value))}
        />
      </Card>

      {step.blocks.map((block, blockIndex) => {
        const path = `${stepPath}.blocks[${blockIndex}]`
        const original = baseBlock(base, block.id)
        const when = block.reveal ? `Appears at +${block.reveal}` : 'On the slide from the start'

        switch (block.type) {
          case 'concept': {
            const label = labelFor('concept', 'Text', blockIndex)
            return (
              <Card key={block.id} title={label} badge={when}>
                <TextField
                  label={label}
                  rows={3}
                  hint={'Write formulas between dollar signs, like $\\Delta S \\ge 0$.'}
                  value={block.text}
                  original={original?.type === 'concept' ? original.text : undefined}
                  problems={problemsAt(problems, `${path}.text`)}
                  onChange={(value) => editBlock(update, stepIndex, blockIndex, 'concept', (b) => void (b.text = value))}
                />
              </Card>
            )
          }
          case 'equation': {
            const label = labelFor('equation', 'Equation', blockIndex)
            return (
              <Card key={block.id} title={label} badge={when}>
                <TextField
                  label={`${label} (LaTeX)`}
                  kind="latex"
                  value={block.latex}
                  original={original?.type === 'equation' ? original.latex : undefined}
                  problems={problemsAt(problems, `${path}.latex`)}
                  onChange={(value) => editBlock(update, stepIndex, blockIndex, 'equation', (b) => void (b.latex = value))}
                />
                <TextField
                  label={`${label} caption`}
                  value={block.caption ?? ''}
                  original={original?.type === 'equation' ? (original.caption ?? '') : undefined}
                  problems={problemsAt(problems, `${path}.caption`)}
                  onChange={(value) => editBlock(update, stepIndex, blockIndex, 'equation', (b) => setOptionalText(b, 'caption', value))}
                />
              </Card>
            )
          }
          case 'question': {
            const question = lesson.questions[block.questionId]
            return question ? (
              <QuestionCard key={block.id} question={question} base={base} update={update} problems={problems} badge={when} />
            ) : null
          }
          case 'explanation':
            return (
              <Card key={block.id} title="Long explanation" badge="Self-Study only · not on the projector">
                <TextField
                  label="Explanation title"
                  value={block.title ?? ''}
                  original={original?.type === 'explanation' ? (original.title ?? '') : undefined}
                  problems={problemsAt(problems, `${path}.title`)}
                  onChange={(value) => editBlock(update, stepIndex, blockIndex, 'explanation', (b) => setOptionalText(b, 'title', value))}
                />
                {block.paragraphs.map((paragraph, index) => (
                  <TextField
                    key={index}
                    label={`Paragraph ${index + 1}`}
                    rows={4}
                    value={paragraph}
                    original={original?.type === 'explanation' ? original.paragraphs[index] : undefined}
                    problems={problemsAt(problems, `${path}.paragraphs[${index}]`)}
                    onChange={(value) => editBlock(update, stepIndex, blockIndex, 'explanation', (b) => void (b.paragraphs[index] = value))}
                  />
                ))}
              </Card>
            )
          case 'diagram':
            return (
              <Card key={block.id} title="Diagram" badge={when}>
                <TextField
                  label="Diagram caption"
                  value={block.caption ?? ''}
                  original={original?.type === 'diagram' ? (original.caption ?? '') : undefined}
                  problems={problemsAt(problems, `${path}.caption`)}
                  onChange={(value) => editBlock(update, stepIndex, blockIndex, 'diagram', (b) => setOptionalText(b, 'caption', value))}
                />
                <p className="text-xs text-ink-faint">The drawing itself is not editable here.</p>
              </Card>
            )
          case 'simulation':
            return (
              <Card key={block.id} title="Simulation" badge={when}>
                <p className="text-sm text-ink-dim">
                  {lesson.simulations[block.simulationId]?.title ?? 'Simulation'} — the animation, its numbers and its labels are not editable here.
                </p>
              </Card>
            )
          case 'summary':
            return (
              <Card key={block.id} title="Summary" badge={when}>
                <p className="text-sm text-ink-dim">This slide shows the lesson summary.</p>
                <button type="button" onClick={onJumpToSummary} className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent hover:underline">
                  Edit the summary →
                </button>
              </Card>
            )
        }
      })}
    </div>
  )
}

const KIND_LABEL: Record<Question['kind'], string> = { prediction: 'Prediction', 'concept-check': 'Concept check', exit: 'Exit question' }

function QuestionCard({
  question,
  base,
  update,
  problems,
  badge,
}: {
  question: Question
  base: LessonDefinition
  update: FormProps['update']
  problems: LessonProblem[]
  badge: string
}) {
  const original = base.questions[question.id]
  const path = `questions.${question.id}`
  const edit = (apply: (question: Question) => void) =>
    update((draft) => {
      const target = draft.questions[question.id]
      if (target) apply(target)
    })

  return (
    <Card title="Question" badge={`${KIND_LABEL[question.kind]} · ${badge}`}>
      <TextField
        label="Question"
        rows={2}
        value={question.prompt}
        original={original?.prompt}
        problems={problemsAt(problems, `${path}.prompt`)}
        onChange={(value) => edit((q) => void (q.prompt = value))}
      />

      <fieldset>
        <legend className="mono-label">Answer choices</legend>
        <p className="mt-1 text-xs text-ink-faint">The colour and shape are the ones students see on their phones. Mark the correct choice.</p>
        <div className="mt-3 space-y-3">
          {question.options.map((option, index) => {
            const look = optionStyle(index, question.options.length)
            const correct = question.correctOptionId === option.id
            return (
              <div key={option.id} className="flex items-start gap-3">
                <span className="mt-[1.9rem] grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: look.bg, color: look.ink }} aria-hidden>
                  <Shape kind={look.shape} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <TextField
                    label={`Answer choice ${index + 1}`}
                    value={option.text}
                    original={original?.options[index]?.text}
                    problems={problemsAt(problems, `${path}.options[${index}].text`)}
                    onChange={(value) => edit((q) => void (q.options[index]!.text = value))}
                  />
                </div>
                <label className={`mt-[1.9rem] flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition ${correct ? 'border-good bg-good/10 text-good' : 'border-line-strong text-ink-dim hover:text-ink'}`}>
                  <input
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={correct}
                    onChange={() => edit((q) => void (q.correctOptionId = option.id))}
                    className="h-3.5 w-3.5 accent-[var(--good)]"
                    aria-label={`Answer choice ${index + 1} is correct`}
                  />
                  Correct
                </label>
              </div>
            )
          })}
        </div>
        {original && question.correctOptionId !== original.correctOptionId && (
          <button type="button" onClick={() => edit((q) => void (q.correctOptionId = original.correctOptionId))} className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink">
            ↺ Reset the correct answer
          </button>
        )}
      </fieldset>

      <TextField
        label="Explanation (shown after the answer)"
        rows={3}
        value={question.explanation}
        original={original?.explanation}
        problems={problemsAt(problems, `${path}.explanation`)}
        onChange={(value) => edit((q) => void (q.explanation = value))}
      />
    </Card>
  )
}

// ── summary ─────────────────────────────────────────────────────────────────

export function SummaryForm({ lesson, base, update, problems }: FormProps) {
  const { summary } = lesson
  return (
    <div className="space-y-5">
      <Card title="Summary" badge="Last slide · Self-Study">
        <TextField
          label="Summary heading"
          value={summary.heading}
          original={base.summary.heading}
          problems={problemsAt(problems, 'summary.heading')}
          onChange={(value) => update((draft) => void (draft.summary.heading = value))}
        />
      </Card>
      {summary.rows.map((row, index) => {
        const original = base.summary.rows[index]
        const path = `summary.rows[${index}]`
        return (
          <Card key={index} title={`Row ${index + 1}`}>
            <TextField
              label={`Row ${index + 1} name`}
              value={row.law}
              original={original?.law}
              problems={problemsAt(problems, `${path}.law`)}
              onChange={(value) => update((draft) => void (draft.summary.rows[index]!.law = value))}
            />
            <TextField
              label={`Row ${index + 1} question`}
              value={row.question}
              original={original?.question}
              problems={problemsAt(problems, `${path}.question`)}
              onChange={(value) => update((draft) => void (draft.summary.rows[index]!.question = value))}
            />
            <TextField
              label={`Row ${index + 1} equation (LaTeX)`}
              kind="latex"
              value={row.equation ?? ''}
              original={original ? (original.equation ?? '') : undefined}
              problems={problemsAt(problems, `${path}.equation`)}
              onChange={(value) => update((draft) => setOptionalText(draft.summary.rows[index]!, 'equation', value))}
            />
            <TextField
              label={`Row ${index + 1} note`}
              value={row.note ?? ''}
              original={original ? (original.note ?? '') : undefined}
              problems={problemsAt(problems, `${path}.note`)}
              onChange={(value) => update((draft) => setOptionalText(draft.summary.rows[index]!, 'note', value))}
            />
          </Card>
        )
      })}
    </div>
  )
}
