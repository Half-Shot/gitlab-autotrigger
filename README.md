## GitLab Autotrigger

A really simple project to automatically trigger a GitLab pipeline when a new GitHub
release is made.

This project expects you to provide your own cron job system.

### Envs

GITLAB_TOKEN="personal-token"
GITLAB_DOMAIN="gitlab.example.com"
AUTOTRIGGER_PROJECTS="github/repo|gitlab/project|optional-container-subpath|VERSION_TAG|EXTRA_VARS%2Cfoo,another/github|another/gitlab"
LOOSE_MATCH_TAG=true

Where autotrigger is a comma seperated list of projects in this format:

`<github_repo>|<gitlab_project>|<container_registry_image_subpath>|<custom_version_pipeline_variable>|<extra_pipeline_variables>`

The default for `custom_version_pipeline_variable` is `TAG_NAME`

`extra_pipeline_variables` must be URI encoded.