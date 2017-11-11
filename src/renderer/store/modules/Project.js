import Project from "@/utils/project";
import settings from "electron-settings";
import * as types from "../mutation-types";
import DockerConfig from "../../utils/docker-config";

const PROJECTS_SCHEMA_VERSION = "1";
const SEP = process.platform === "win32" ? "\\" : "/";

const state = {
  projectsSchemaVersion: settings.get("projectsSchemaVersion"),
  projects: []
};

const mutations = {
  [types.UPDATE_PROJECTS](state, projects) {
    state.projects = projects;
  },

  [types.ADD_PROJECT](state, dir) {
    const project = new Project(dir, state.projects.length);
    state.projects.push(project.toJson());
    settings.set("projects", state.projects);
  },

  [types.REMOVE_PROJECT](state, projectId) {
    state.projects.splice(projectId, 1);
    settings.set("projects", state.projects);
  }
};

const getters = {
  projects(state) {
    return state.projects.map((p, i) => new Project(p, i));
  },

  projectRunning: (state, getters) => id => {
    return state.projects[id].services.every(s =>
      getters
        .containersForProject(id)
        .find(c => c.service === s && c.state === "running")
    );
  },

  projectPartiallyRunning: (state, getters) => id => {
    return getters.containersForProject(id).some(c => c.state === "running");
  },

  /**
   * Get the name of the app, formatted for Docker consumption
   */
  projectName: state => id => {
    return state.projects[id].dir
      .split(SEP)
      .pop()
      .replace(/-/g, "");
  },

  /**
   * Get the final name of the directory where the project lives
   */
  projectDirName: state => id => {
    return state.projects[id].dir.split(SEP).pop();
  },

  containersForProject: (state, getters) => id => {
    const project = state.projects[id];
    return getters.containers
      .filter(c => c.project === getters.projectName(id))
      .filter(c => !c.temp)
      .filter(c => project.services.includes(c.service));
  }
};

const actions = {
  loadProjects({ commit }) {
    // Fetch the JSON data persisted in storage
    let projects = settings.get("projects", []);

    projects.forEach(p => {
      // Build a list of service names based on the YML Compose file
      const config = new DockerConfig(p);
      p.missingComposeFile = !config.data;
      p.services = config.services();
    });

    commit(types.UPDATE_PROJECTS, projects);
  },

  migrateProjectSchema({ getters, commit, state }) {
    if (state.projectsSchemaVersion !== PROJECTS_SCHEMA_VERSION) {
      commit("UPDATE_SETTING", {
        key: "projects",
        value: getters.projects.map(p => p.toJson())
      });

      commit("UPDATE_SETTING", {
        key: "projectsSchemaVersion",
        value: PROJECTS_SCHEMA_VERSION
      });
    }
  }
};

export default {
  state,
  mutations,
  getters,
  actions
};
