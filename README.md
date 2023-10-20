## GitLab Autotrigger

A really simple project to automatically trigger a GitLab pipeline when a new GitHub
release is made.

This project expects you to provide your own cron job system.

### Envs

GITLAB_TOKEN="personal-token"
GITLAB_DOMAIN="gitlab.example.com"
AUTOTRIGGER_PROJECTS="github/repo|gitlab/project|optional-container-subpath,another/github|another/gitlab"