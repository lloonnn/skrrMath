// Made-up sample data for the sidebar. Not from any school paper.
// Replaced by the papers table once sign-in and storage exist.

export type Paper = {
  id: string
  title: string
  marked: number
  total: number
}

export type Year = {
  year: number
  papers: Paper[]
}

export type Course = {
  code: string
  name: string
  years: Year[]
}

export const sampleCourses: Course[] = [
  {
    code: "EXAMPLE101",
    name: "Example course",
    years: [
      {
        year: 2023,
        papers: [
          { id: "ex101-2023-p1", title: "Paper 1", marked: 1, total: 3 },
          { id: "ex101-2023-p2", title: "Paper 2", marked: 0, total: 4 },
        ],
      },
      {
        year: 2022,
        papers: [{ id: "ex101-2022-p1", title: "Paper 1", marked: 0, total: 3 }],
      },
    ],
  },
  {
    code: "SAMPLE202",
    name: "Another course",
    years: [
      {
        year: 2023,
        papers: [{ id: "sa202-2023-p1", title: "Paper 1", marked: 2, total: 4 }],
      },
    ],
  },
]
