## GitLab Autotrigger

A really simple project to automatically trigger a GitLab pipeline when a new GitHub
release is made.

This project expects you to provide your own cron job system.

### Envs

```sh
GITLAB_TOKEN="personal-token"
GITLAB_DOMAIN="gitlab.example.com"
AUTOTRIGGER_PROJECTS="github/repo|gitlab/project|optional-container-subpath|VERSION_TAG|EXTRA_VARS%2Cfoo,another/github|another/gitlab"
LOOSE_MATCH_TAG=true # Check whether an image *starts* with the latest tag, rather than an exact match.
```

Where autotrigger is a comma seperated list of projects in this format:

`<github_repo>|<gitlab_project>|<container_registry_image_subpath>|<custom_version_pipeline_variable>|<extra_pipeline_variables>`


The default for `custom_version_pipeline_variable` is `TAG_NAME` and `extra_pipeline_variables` must be URI encoded.

So some valid examples are:

- Single project: `Half-Shot/gitlab-autotrigger|mygitlab/myproject`
- With image path: `Half-Shot/gitlab-autotrigger|mygitlab/myproject|subimage`
- With custom variable: `Half-Shot/gitlab-autotrigger|mygitlab/myproject||CUSTOM_TAG`
- With both: `Half-Shot/gitlab-autotrigger|mygitlab/myproject|subimage|CUSTOM_TAG`
- Multiple projects: `Half-Shot/gitlab-autotrigger|mygitlab/myproject,Half-Shot/other-project|mygitlab/otherproject`
