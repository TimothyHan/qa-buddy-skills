import { test, expect } from '@playwright/test';
import { projectsPage } from '../pom/projects.page';
import { createProject } from '../api/projects';

test.describe('Projects', () => {
  test('TC-03: duplicate project name rejected', async ({ page, request, disposalContext }) => {
    const name = `dup-${Date.now()}-w${test.info().parallelIndex}`;
    await createProject(request, name, disposalContext);
    await projectsPage.goto(page);
    await projectsPage.openNewProject(page);
    await projectsPage.locators.nameInput(page).fill(name);
    await projectsPage.locators.createSubmit(page).click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('TC-04: delete a project', async ({ page, request, disposalContext }) => {
    const name = `del-${Date.now()}-w${test.info().parallelIndex}`;
    await createProject(request, name, disposalContext);
    await projectsPage.goto(page);
    await projectsPage.deleteByName(page, name);
    await expect(projectsPage.locators.rowByName(page, name)).toHaveCount(0);
  });
});
