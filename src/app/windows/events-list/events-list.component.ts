import { Component, Input } from '@angular/core';
import { WindowParameters } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import moment from 'moment';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.css',
})
export class EventsListComponent {
  @Input() parameters: WindowParameters = {
    eventsList: [],
    date: new Date(),
  };

  ngOnInit(): void {
    console.log(this.parameters.eventsList);
  }

  getFormattedDate(): string {
    return moment(this.parameters.date).format('ddd, Do MMMM YYYY'); // Format: 'Mon, 1 January 2021'
  }
}
