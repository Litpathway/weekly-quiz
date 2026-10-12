# Weekly Quiz: setup (about 10 minutes)

## 1. Put the project on Vercel
Easiest from a phone or laptop with no tools:
1. Create a free GitHub account, make a new repository (e.g. `weekly-quiz`).
2. Upload everything from this folder (the `api` folder, the `public` folder, `package.json`, `vercel.json`). On GitHub: Add file > Upload files.
3. On vercel.com choose Add New > Project, import that repository, and press Deploy. Leave all settings as they are.

(With a computer you can instead run `npx vercel` inside this folder.)

## 2. Add the database (free)
1. In your Vercel project open the Storage tab > Create Database > Upstash Redis (free plan).
2. Connect it to the project when asked. This adds the connection settings for you.

## 3. Set the admin password
Project Settings > Environment Variables > add:
- Name: `ADMIN_PASSWORD`
- Value: a password only you know

## 4. Redeploy
Deployments tab > latest deployment > Redeploy. After that:
- Students use:  https://YOUR-PROJECT.vercel.app
- You use:       https://YOUR-PROJECT.vercel.app/admin

## Turn off Vercel login for visitors
Project Settings > Deployment Protection > set to Disabled (or "Only Preview Deployments"),
otherwise students may be asked to log in to Vercel.

## Every week
Open /admin > Weeks > Add a new week. Paste the quiz JSON and press Publish.
The newest week shows as "This week". Older weeks appear under "Past weeks" for newcomers.
Use "Close for students" on a week to hide it.
