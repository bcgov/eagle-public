import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Document } from '../../../models/document';
import { Project } from '../../../models/project';
import { ApiService } from '../../../services/api';
import { StorageService } from '../../../services/storage.service';
import { ListConverterPipe } from '../../../shared/pipes/list-converter.pipe';

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.css'],
  imports: [RouterLink, DatePipe, ListConverterPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  public readonly api = inject(ApiService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly storageService = inject(StorageService);

  private readonly destroyRef = inject(DestroyRef);
  public readonly document = signal<Document | null>(null);
  public readonly currentProject = signal<Project | null>(null);

  ngOnInit() {
    this.currentProject.set(this.storageService.state.currentProject.data);

    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        this.document.set(res.document);
        this.changeDetectorRef.detectChanges();
      });
  }

  onEdit() {
    const doc = this.document();
    if (doc) {
      this.storageService.state.selectedDocs = [doc];
      this.storageService.state.labels = doc.labels;
      this.storageService.state.back = { 
        url: ['/p', doc.project, 'project-documents', 'detail', doc._id], 
        label: 'View Document' 
      };
      this.router.navigate(['p', doc.project, 'project-documents', 'edit']);
    }
  }

}
