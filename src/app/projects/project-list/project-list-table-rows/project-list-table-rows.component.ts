import { Component, EventEmitter, Output } from '@angular/core';

import { Router } from '@angular/router';
import { ApiService } from 'app/services/api';
import { FavoriteService } from 'app/services/favorite.service';
import { ITableMessage, TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';

@Component({
    selector: 'app-project-list-table-rows',
    templateUrl: './project-list-table-rows.component.html',
    styleUrls: ['./project-list-table-rows.component.scss']
})

export class ProjectListTableRowsComponent extends TableRowComponent {
    @Output() updateFavorites: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

    constructor(
        private router: Router,
        public apiService: ApiService,
        public favoriteService: FavoriteService,
    ) {
        super();
    }

    goToProject(project) {
        this.router.navigate([`p/${project._id}/project-details`]);
    }

    public addToFavorite(item, type: string = 'Project') {
      this.apiService.addFavorite(item, type)
        .then(() => {
          this.updateFavorites.emit({data: {type}, label: 'Update Favorite'});
        }).catch((err) => {
          console.log('error adding favorite', err)
        });
    }

    public removeFavorite(item) {
      this.apiService.removeFavorite(item)
        .then(() => {
          this.updateFavorites.emit({data: {type: 'Project'}, label: 'Update Favorite'});
        }).catch((err) => {
          console.log('error removing favorite', err)
        });
    }
}
