import Core = require("TFS/Core/RestClient");
import Work = require("TFS/Work/RestClient");
import Controls = require("VSS/Controls");
import Utils_Array = require("VSS/Utils/Array");
import Utils_String = require("VSS/Utils/String");
import VSS_StatusIndicator = require("VSS/Controls/StatusIndicator");
import { IdentityRef } from "VSS/WebApi/Contracts";
import { WebApiTeam, TeamContext } from "TFS/Core/Contracts";
import { TeamFieldValues } from "TFS/Work/Contracts";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { IdentityPickerDropdownControl, IdentityPickerSearchControl, IIdentityPickerSearchOptions, IIdentityPickerDropdownOptions } from "VSS/Identities/Picker/Controls";
import { ITeamAreaPaths, ITeamMembers } from "./models";
import Q = require("q");

export interface ITeamFinderDialogConfiguration {
    project: string;
    areaPathChanged: (areaPath: string) => void;
}

export class TeamFinderDialog {
    private configuration: ITeamFinderDialogConfiguration;
    private project: string;
    private teams: WebApiTeam[];
    private teamMembers: IDictionaryStringTo<IdentityRef[]>;
    private areaPaths: IDictionaryStringTo<string[]>;

    private identityToTeamMapping: IDictionaryStringTo<string[]> = {};
    private identityIdToIdentityRefMapping: IDictionaryStringTo<IdentityRef> = {};
    private identities: string[] = [];

    private areaPathCombo: Combo;

    public initialize() {
        this.configuration = VSS.getConfiguration();
        this.project = this.configuration.project;

        let container = $("#container");
        let parentHeight = container.parentsUntil("#document").parent().height();

        container.height(parentHeight);

        let statusIndicatorContainer = $("<div />").attr("id", "status-indicator-container").appendTo(container);
        statusIndicatorContainer.css("display", "inline");
        statusIndicatorContainer.height(parentHeight);

        let statusIndicator = Controls.create(VSS_StatusIndicator.StatusIndicator, statusIndicatorContainer, {
            center: true,
            imageClass: "big-status-progress",
            message: "Loading teams..."
        });

        statusIndicator.start();

        let teamService = new TeamService();

        Q.fcall(() => {
        }).then(() => {
            return teamService.getTeams(this.project);
        }).then((teams: WebApiTeam[]) => {
            this.teams = teams;
            statusIndicator.setMessage("Loading team members...");

            return teamService.getAllTeamMembers(this.project, this.teams);
        }).then((teamMembers: IDictionaryStringTo<IdentityRef[]>) => {
            this.teamMembers = teamMembers;
            statusIndicator.setMessage("Loading team area paths...");

            return teamService.getAllTeamAreaPaths(this.project, this.teams);
        }).then((areaPaths: IDictionaryStringTo<string[]>) => {
            this.areaPaths = areaPaths;
            this.buildIdentityMaps();
            statusIndicator.complete();

            this.createControls();
        }).catch((reason) => {
            statusIndicator.complete();
            console.error(reason);
            debugger;
        });
    }

    public getSelectedAreaPath(): string {
        return this.areaPathCombo.getValue<string>();
    }

    private buildIdentityMaps() {
        $.each(this.teamMembers, (team: string, members: IdentityRef[]) => {
            $.each(members, (index, member) => {
                let comboDisplayName = `${member.displayName} <${member.uniqueName}>`;
                if ($.inArray(comboDisplayName, this.identities) == -1) {
                    this.identities.push(`${member.displayName} <${member.uniqueName}>`);
                }

                if (!this.identityToTeamMapping[comboDisplayName]) {
                    this.identityToTeamMapping[comboDisplayName] = [team];
                }
                else if ($.inArray(team, this.identityToTeamMapping[comboDisplayName]) == -1) {
                    this.identityToTeamMapping[comboDisplayName].push(team);
                }
            });
        });

        Utils_Array.sortIfNotSorted<string>(this.identities, Utils_String.localeIgnoreCaseComparer);
    }

    private createControls() {
        let identityComboContainer = $("<div />").attr("id", "identity-combo-container").appendTo("#container");
        $("<label />").text("Team Member: ").appendTo(identityComboContainer);

        let identityComboOptions: IComboOptions = {
            mode: "drop",
            source: this.identities,
            autoComplete: true,
            enableFilter: true,
            indexChanged: (index: number) => {
                let identity = identityCombo.getValue<string>();
                let teams = this.identityToTeamMapping[identity];

                let paths: string[] = [];
                teams.forEach((team) => {
                    paths = paths.concat(this.areaPaths[team]);
                });

                Utils_Array.sortIfNotSorted<string>(paths, Utils_String.localeIgnoreCaseComparer);

                this.areaPathCombo.setText("");
                this.areaPathCombo.setSource(paths);
            }
        };

        let identityCombo = Controls.create(Combo, identityComboContainer, identityComboOptions);

        let areaPathComboContainer = $("<div />").attr("id", "area-path-combo-container").appendTo("#container");
        $("<label />").text("Area Paths: ").appendTo(areaPathComboContainer);

        let areaPathComboOptions: IComboOptions = {
            mode: "drop",
            source: [],
            indexChanged: (index: number) => {
                let areaPath = this.areaPathCombo.getText();
                if ($.isFunction(this.configuration.areaPathChanged)) {
                    this.configuration.areaPathChanged(areaPath);
                }
            }
        };

        this.areaPathCombo = Controls.create(Combo, areaPathComboContainer, areaPathComboOptions);
    }
}

export class TeamService {

    public TeamService() {

    }

    public getTeams(project: string): IPromise<WebApiTeam[]> {
        let deferred = Q.defer<WebApiTeam[]>();
        let client = Core.getClient();
        let teams: WebApiTeam[] = [];
        let top: number = 200;

        let getTeamDelegate = (project: string, skip: number) => {
            client.getTeams(project, top, skip).then((items: WebApiTeam[]) => {
                teams = teams.concat(items);
                if (items.length == top) {
                    getTeamDelegate(project, skip + top);
                }
                else {
                    deferred.resolve(teams);
                }
            });
        };

        getTeamDelegate(project, 0);

        return deferred.promise;
    }

    public getAllTeamMembers(project: string, teams: WebApiTeam[]): IPromise<IDictionaryStringTo<IdentityRef[]>> {
        let deferred = Q.defer<IDictionaryStringTo<IdentityRef[]>>();
        let promises: IPromise<ITeamMembers>[] = [];
        let teamMembers: IDictionaryStringTo<IdentityRef[]> = {};

        teams.forEach((team) => {
            promises.push(this.getTeamMembers(project, team));
        });

        Q.all(promises).then((allTeamMembers: ITeamMembers[]) => {
            allTeamMembers.forEach((members) => {
                teamMembers[members.team] = members.members;
            });

            deferred.resolve(teamMembers);
        });

        return deferred.promise;
    }

    private getTeamMembers(project: string, team: WebApiTeam): IPromise<ITeamMembers> {
        let client = Core.getClient();
        let deferred = Q.defer<ITeamMembers>();

        client.getTeamMembers(project, team.id).then((members) => {
            deferred.resolve({
                team: team.name,
                members: members
            });
        });

        return deferred.promise;
    }

    public getAllTeamAreaPaths(project: string, teams: WebApiTeam[]): IPromise<IDictionaryStringTo<string[]>> {
        let deferred = Q.defer<IDictionaryStringTo<string[]>>();
        let promises: IPromise<ITeamAreaPaths>[] = [];
        let teamAreaPaths: IDictionaryStringTo<string[]> = {};

        teams.forEach((team) => {
            promises.push(this.getTeamAreaPaths(project, team));
        });

        Q.all(promises).then((allTeamAreaPaths: ITeamAreaPaths[]) => {
            allTeamAreaPaths.forEach((teamAreaPath) => {
                teamAreaPaths[teamAreaPath.team] = teamAreaPath.areaPaths;
            });

            deferred.resolve(teamAreaPaths);
        });

        return deferred.promise;
    }

    private getTeamAreaPaths(project: string, team: WebApiTeam): IPromise<ITeamAreaPaths> {
        let workClient = Work.getClient();
        let teamContext: TeamContext = {
            project: project,
            projectId: null,
            team: null,
            teamId: team.id
        };

        let deferred = Q.defer<ITeamAreaPaths>();

        workClient.getTeamFieldValues(teamContext).then((fieldValues) => {
            if (fieldValues.field.referenceName == "System.AreaPath") {
                deferred.resolve({
                    team: team.name,
                    areaPaths: fieldValues.values.map((teamFieldValue) => {
                        return teamFieldValue.value;
                    })
                });
            }
            else {
                deferred.resolve({
                    team: team.name,
                    areaPaths: []
                });
            }
        });

        return deferred.promise;
    }
}

VSS.register("dialog", new TeamFinderDialog());