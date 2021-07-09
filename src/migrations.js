const { withSpinner, step } = require('./command-helpers/spinner')

const MIGRATIONS = [
  require('./migrations/mapping_api_version_0_0_1'),
  require('./migrations/mapping_api_version_0_0_2'),
  require('./migrations/mapping_api_version_0_0_3'),
  require('./migrations/mapping_api_version_0_0_4'),
  require('./migrations/spec_version_0_0_2'),
]

const applyMigrations = async options =>
  await withSpinner(
    `Apply migrations`,
    `Failed to apply migrations`,
    `Warnings while applying migraitons`,
    async spinner => {
      await MIGRATIONS.reduce(async (previousPromise, migration) => {
        await previousPromise

        let skipHint = await migration.predicate(options)
        if (typeof skipHint !== 'string' && skipHint) {
          step(spinner, 'Apply migration:', migration.name)
          await migration.apply(options)
        } else {
          if (typeof skipHint === 'string') {
            step(spinner, 'Skip migration:', `${migration.name} (${skipHint})`)
          } else {
            step(spinner, 'Skip migration:', `${migration.name}`)
          }
        }
      }, Promise.resolve())
    },
  )

module.exports = {
  applyMigrations,
}
