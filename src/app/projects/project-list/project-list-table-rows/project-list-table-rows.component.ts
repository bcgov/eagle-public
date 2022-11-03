import { Component, EventEmitter, Output } from '@angular/core';

import { Router } from '@angular/router';
import { ApiService } from 'app/services/api';
import { FavouriteService } from 'app/services/favourite.service';
import { ITableMessage, TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';

@Component({
    selector: 'app-project-list-table-rows',
    templateUrl: './project-list-table-rows.component.html',
    styleUrls: ['./project-list-table-rows.component.scss']
})

export class ProjectListTableRowsComponent extends TableRowComponent {
    @Output() updateFavourites: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

    constructor(
        private router: Router,
        public apiService: ApiService,
        public favouriteService: FavouriteService,
    ) {
        super();
    }

    goToProject(project) {
        this.router.navigate([`p/${project._id}/project-details`]);
    }

    public addToFavourite(item, type: string = 'Project') {
      this.apiService.addFavourite(item, type)
        .then(() => {
          this.updateFavourites.emit({data: {type}, label: 'Update Favourite'});
        }).catch((err) => {
          console.log('error adding favourite', err)
        });
    }

    public removeFavourite(item) {
      this.apiService.removeFavourite(item)
        .then(() => {
          this.updateFavourites.emit({data: {type: 'Project'}, label: 'Update Favourite'});
        }).catch((err) => {
          console.log('error removing favourite', err)
        });
    }
}
